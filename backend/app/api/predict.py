"""
predict.py — POST /api/predict
Accepts a single transaction's features and returns fraud prediction.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
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


class PredictionResponse(BaseModel):
    is_fraud: bool
    fraud_probability: float
    risk_level: str


@router.post("/predict", response_model=PredictionResponse, summary="Predict fraud for a single transaction")
async def predict(transaction: TransactionInput):
    """
    Accepts transaction features and returns:
    - is_fraud: bool
    - fraud_probability: float (0-1)
    - risk_level: "low" | "medium" | "high"
    """
    try:
        features = transaction.model_dump()
        # Lowercase keys for model service
        features_lower = {k.lower(): v for k, v in features.items() if v is not None}
        service = get_model_service()
        result = service.predict(features_lower)
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
