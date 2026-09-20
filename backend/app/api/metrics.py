"""
metrics.py — GET /api/metrics
Returns model performance metrics and live transaction statistics.
"""

import os
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import get_db
from app.models.transaction import Transaction

router = APIRouter()

BASE_DIR = os.path.dirname(__file__)
ML_MODELS_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "..", "..", "ml", "models")
)


def _load_metrics(filename: str) -> dict:
    path = os.path.join(ML_MODELS_DIR, filename)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


@router.get("/metrics", summary="Model performance metrics and live stats")
async def get_metrics(db: Session = Depends(get_db)):
    """
    Returns:
    - Model performance (precision, recall, F1, ROC-AUC) from saved metrics files
    - Live stats: total transactions processed, fraud rate, high-risk count
    - Baseline comparison (if baseline_metrics.json exists)
    """
    # Load saved model metrics
    xgb_metrics = _load_metrics("xgboost_metrics.json")
    baseline_metrics = _load_metrics("baseline_metrics.json")

    # Live stats from database
    total = db.query(func.count(Transaction.id)).scalar() or 0
    fraud_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.is_fraud == True)
        .scalar()
        or 0
    )
    high_risk = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_level == "high")
        .scalar()
        or 0
    )
    medium_risk = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_level == "medium")
        .scalar()
        or 0
    )
    unreviewed = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.is_fraud == True, Transaction.reviewed == False)
        .scalar()
        or 0
    )

    return {
        "model_metrics": {
            "xgboost": {
                "model_name": xgb_metrics.get("model", "XGBoost"),
                "precision": xgb_metrics.get("precision"),
                "recall": xgb_metrics.get("recall"),
                "f1": xgb_metrics.get("f1"),
                "roc_auc": xgb_metrics.get("roc_auc"),
                "note": xgb_metrics.get("note"),
            },
            "baseline": {
                "model_name": baseline_metrics.get("model", "Logistic Regression"),
                "precision": baseline_metrics.get("precision"),
                "recall": baseline_metrics.get("recall"),
                "f1": baseline_metrics.get("f1"),
                "roc_auc": baseline_metrics.get("roc_auc"),
            },
        },
        "live_stats": {
            "total_transactions": total,
            "fraud_detected": fraud_count,
            "fraud_rate": round(fraud_count / total, 4) if total > 0 else 0.0,
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "unreviewed_alerts": unreviewed,
            "normal_count": total - fraud_count,
        },
    }
