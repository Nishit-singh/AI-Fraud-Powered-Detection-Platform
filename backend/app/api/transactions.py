"""
transactions.py — Transaction history and simulation endpoints.

POST /api/transactions/simulate — generate N synthetic transactions, run through model, store in DB
GET  /api/transactions           — paginated transaction history, filterable by risk_level & date
PUT  /api/transactions/{id}/review — mark a transaction as reviewed
"""

from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, Integer

from app.models.database import get_db
from app.models.transaction import Transaction
from app.services.model_service import get_model_service
from app.services.synthetic_data import generate_transactions

router = APIRouter()


class SimulateRequest(BaseModel):
    n: int = 20
    fraud_rate: float = 0.15


class TransactionOut(BaseModel):
    id: int
    transaction_time: datetime
    amount: float
    is_fraud: bool
    fraud_probability: float
    risk_level: str
    reviewed: bool
    source: str
    transaction_hour: Optional[int]

    class Config:
        from_attributes = True


class PaginatedTransactions(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[TransactionOut]


@router.post(
    "/transactions/simulate",
    summary="Simulate N synthetic transactions and run them through the model"
)
async def simulate_transactions(
    req: SimulateRequest,
    db: Session = Depends(get_db)
):
    """
    Generates N synthetic transactions (mix of normal & fraud-like patterns),
    runs each through the model, and stores results in the database.
    Returns a summary of what was created.
    """
    service = get_model_service()
    synthetic = generate_transactions(n=req.n, fraud_rate=req.fraud_rate)

    created = []
    fraud_count = 0

    for item in synthetic:
        features = item["features"]
        prediction = service.predict(features)

        # Build Transaction ORM object
        tx = Transaction(
            transaction_time=datetime.utcnow() - timedelta(seconds=len(created) * 3),
            amount=features.get("amount", 0),
            is_fraud=prediction["is_fraud"],
            fraud_probability=prediction["fraud_probability"],
            risk_level=prediction["risk_level"],
            transaction_hour=features.get("transaction_hour", datetime.utcnow().hour),
            amount_zscore=features.get("amount_zscore", 0),
            is_simulated=True,
            source="simulate",
            reviewed=False,
        )
        # Copy V1-V28
        for i in range(1, 29):
            setattr(tx, f"v{i}", features.get(f"v{i}", 0))

        db.add(tx)
        if prediction["is_fraud"]:
            fraud_count += 1
        created.append({
            "amount": tx.amount,
            "is_fraud": tx.is_fraud,
            "fraud_probability": tx.fraud_probability,
            "risk_level": tx.risk_level,
        })

    db.commit()

    return {
        "message": f"Simulated {req.n} transactions",
        "total_created": req.n,
        "fraud_flagged": fraud_count,
        "normal": req.n - fraud_count,
        "fraud_rate": round(fraud_count / req.n, 4),
        "transactions": created,
    }


@router.get(
    "/transactions",
    response_model=PaginatedTransactions,
    summary="Get paginated transaction history"
)
async def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    risk_level: Optional[str] = Query(None, description="Filter: low | medium | high"),
    is_fraud: Optional[bool] = Query(None, description="Filter: true = fraud only, false = normal only"),
    reviewed: Optional[bool] = Query(None, description="Filter: true = reviewed, false = unreviewed"),
    source: Optional[str] = Query(None, description="Filter: simulate | manual | csv"),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    """Return paginated transaction history, filterable by risk_level, is_fraud, reviewed, source, and date range."""
    query = db.query(Transaction)

    if risk_level:
        query = query.filter(Transaction.risk_level == risk_level)
    if is_fraud is not None:
        query = query.filter(Transaction.is_fraud == is_fraud)
    if reviewed is not None:
        query = query.filter(Transaction.reviewed == reviewed)
    if source:
        query = query.filter(Transaction.source == source)
    if from_date:
        query = query.filter(Transaction.transaction_time >= from_date)
    if to_date:
        query = query.filter(Transaction.transaction_time <= to_date)

    total = query.count()
    items = (
        query.order_by(desc(Transaction.transaction_time))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedTransactions(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.put(
    "/transactions/{tx_id}/review",
    summary="Mark a transaction alert as reviewed"
)
async def review_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.reviewed = True
    db.commit()
    return {"id": tx_id, "reviewed": True, "message": "Transaction marked as reviewed"}


@router.get(
    "/transactions/{tx_id}",
    summary="Get a single transaction by ID (full detail including V1-V28)"
)
async def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    """
    Returns the full Transaction record including all PCA features (V1-V28),
    engineered features, prediction results, and metadata.
    """
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail=f"Transaction #{tx_id} not found")

    # Build a complete dict — avoids partial schema issues with V columns
    result = {
        "id": tx.id,
        "transaction_time": tx.transaction_time,
        "amount": tx.amount,
        "is_fraud": tx.is_fraud,
        "fraud_probability": tx.fraud_probability,
        "risk_level": tx.risk_level,
        "transaction_hour": tx.transaction_hour,
        "amount_zscore": tx.amount_zscore,
        "is_simulated": tx.is_simulated,
        "source": tx.source,
        "reviewed": tx.reviewed,
        "features": {f"V{i}": getattr(tx, f"v{i}", None) for i in range(1, 29)},
    }
    return result


@router.get("/transactions/stats/hourly", summary="Fraud rate bucketed by hour")
async def hourly_fraud_stats(db: Session = Depends(get_db)):
    """Returns transaction counts and fraud rate per hour for the line chart."""
    results = (
        db.query(
            Transaction.transaction_hour,
            func.count(Transaction.id).label("total"),
            func.sum(Transaction.is_fraud.cast(Integer)).label("fraud_count"),
        )
        .group_by(Transaction.transaction_hour)
        .order_by(Transaction.transaction_hour)
        .all()
    )

    data = []
    for row in results:
        hour = row.transaction_hour or 0
        total = row.total or 0
        fraud = int(row.fraud_count or 0)
        data.append({
            "hour": hour,
            "label": f"{hour:02d}:00",
            "total": total,
            "fraud": fraud,
            "fraud_rate": round(fraud / total, 4) if total > 0 else 0,
        })

    return {"data": data}
