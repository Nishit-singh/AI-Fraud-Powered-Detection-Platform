"""
predict.py — POST /api/predict
Accepts a single transaction's features and returns fraud prediction + SHAP explanation.
Every call persists one Transaction row with source="manual" | "simulate" | "csv".
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List

from app.models.database import get_db
from app.models.transaction import Transaction
from app.services.model_service import get_model_service

router = APIRouter()


class TransactionInput(BaseModel):
    Amount: float = Field(..., ge=0, description="Transaction amount in USD")
    V1: Optional[float] = 0.0
    V2: Optional[float] = 0.0
    V3: Optional[float] = 0.0
    V4: Optional[float] = 0.0
    V5: Optional[float] = 0.0
    V6: Optional[float] = 0.0
    V7: Optional[float] = 0.0
    V8: Optional[float] = 0.0
    V9: Optional[float] = 0.0
    V10: Optional[float] = 0.0
    V11: Optional[float] = 0.0
    V12: Optional[float] = 0.0
    V13: Optional[float] = 0.0
    V14: Optional[float] = 0.0
    V15: Optional[float] = 0.0
    V16: Optional[float] = 0.0
    V17: Optional[float] = 0.0
    V18: Optional[float] = 0.0
    V19: Optional[float] = 0.0
    V20: Optional[float] = 0.0
    V21: Optional[float] = 0.0
    V22: Optional[float] = 0.0
    V23: Optional[float] = 0.0
    V24: Optional[float] = 0.0
    V25: Optional[float] = 0.0
    V26: Optional[float] = 0.0
    V27: Optional[float] = 0.0
    V28: Optional[float] = 0.0
    transaction_hour: Optional[int] = None
    amount_zscore: Optional[float] = None


# ── Response models ──────────────────────────────────────────────────────────

class FeatureFactor(BaseModel):
    feature: str
    contribution: float
    strength: str   # "strong" | "moderate" | "weak"


class Explanation(BaseModel):
    top_fraud_factors: List[FeatureFactor]
    top_normal_factors: List[FeatureFactor]
    note: str


class PredictionResponse(BaseModel):
    is_fraud: bool
    fraud_probability: float
    risk_level: str
    explanation: Optional[Explanation] = None


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Predict fraud for a single transaction (with SHAP explanation)"
)
async def predict(transaction: TransactionInput, db: Session = Depends(get_db)):
    """
    Accepts transaction features and returns:
    - is_fraud: bool
    - fraud_probability: float (0-1)
    - risk_level: "low" | "medium" | "high"
    - explanation: SHAP-based top contributing features (optional, null on failure)

    Also persists a Transaction row with source="manual", is_simulated=False.
    Existing clients that ignore the new `explanation` field are unaffected.
    """
    try:
        features = transaction.model_dump()
        # Lowercase keys for model service
        features_lower = {k.lower(): v for k, v in features.items() if v is not None}
        service = get_model_service()
        result = service.predict(features_lower)

        # --- SHAP explanation (never fails the endpoint) ---
        explanation = None
        try:
            shap_data = service.explain(features_lower)
            if shap_data is not None:
                explanation = Explanation(**shap_data)
        except Exception as shap_err:
            # Log but do not propagate — prediction is still valid
            print(f"[predict] explanation skipped: {shap_err}")

        # --- Persist to database (pattern mirrors /transactions/simulate) ---
        tx = Transaction(
            transaction_time=datetime.utcnow(),
            amount=transaction.Amount,
            is_fraud=result["is_fraud"],
            fraud_probability=result["fraud_probability"],
            risk_level=result["risk_level"],
            transaction_hour=features_lower.get("transaction_hour"),
            amount_zscore=features_lower.get("amount_zscore"),
            is_simulated=False,
            source="manual",
            reviewed=False,
        )
        # Copy V1-V28
        for i in range(1, 29):
            setattr(tx, f"v{i}", getattr(transaction, f"V{i}", 0.0) or 0.0)

        db.add(tx)
        db.commit()
        # -------------------------------------------------------------------

        return PredictionResponse(
            **result,
            explanation=explanation,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
