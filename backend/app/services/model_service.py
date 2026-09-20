"""
model_service.py — Loads and serves the XGBoost fraud detection model.
Falls back to a mock predictor if the model file doesn't exist yet.
"""

import os
import json
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any

BASE_DIR = os.path.dirname(__file__)
ML_DIR = os.path.join(BASE_DIR, "..", "..", "ml", "models")

MODEL_PATH = os.path.abspath(os.path.join(ML_DIR, "fraud_xgb_model.pkl"))
FEATURE_NAMES_PATH = os.path.abspath(os.path.join(ML_DIR, "feature_names.json"))


FEATURE_NAMES = [f"V{i}" for i in range(1, 29)] + [
    "Amount", "transaction_hour", "amount_zscore"
]

# Global amount stats for z-score calculation (updated when real data is used)
AMOUNT_MEAN = 88.35
AMOUNT_STD = 250.12


class FraudModelService:
    def __init__(self):
        self._model = None
        self._scaler = None
        self._feature_names = FEATURE_NAMES
        self._load_model()

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                artifact = joblib.load(MODEL_PATH)
                self._model = artifact["model"]
                self._scaler = artifact["scaler"]
                self._feature_names = artifact.get("feature_names", FEATURE_NAMES)
                print(f"[ModelService] Loaded model from {MODEL_PATH}")
            except Exception as e:
                print(f"[ModelService] Warning: could not load model — {e}")
                self._model = None
        else:
            print(f"[ModelService] No model at {MODEL_PATH}. Using heuristic fallback.")

    def _build_feature_vector(self, features: Dict[str, Any]) -> np.ndarray:
        """Build ordered feature vector from a dict."""
        vec = []
        for name in self._feature_names:
            key = name.lower()
            # Try exact match first
            if key in features:
                vec.append(float(features[key]))
            elif name in features:
                vec.append(float(features[name]))
            else:
                vec.append(0.0)
        return np.array(vec, dtype=np.float32).reshape(1, -1)

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict fraud probability for a single transaction.
        Returns: {is_fraud, fraud_probability, risk_level}
        """
        # Add engineered features if not present
        amount = float(features.get("Amount", features.get("amount", 0)))
        if "transaction_hour" not in features:
            features["transaction_hour"] = datetime.utcnow().hour
        if "amount_zscore" not in features:
            features["amount_zscore"] = (amount - AMOUNT_MEAN) / AMOUNT_STD

        if self._model is not None:
            X = self._build_feature_vector(features)
            if self._scaler:
                X = self._scaler.transform(X)
            prob = float(self._model.predict_proba(X)[0, 1])
        else:
            # Heuristic fallback: simple rules for demo
            prob = self._heuristic_predict(features)

        is_fraud = prob >= 0.5
        if prob < 0.3:
            risk_level = "low"
        elif prob < 0.6:
            risk_level = "medium"
        else:
            risk_level = "high"

        return {
            "is_fraud": is_fraud,
            "fraud_probability": round(prob, 4),
            "risk_level": risk_level,
        }

    def _heuristic_predict(self, features: Dict[str, Any]) -> float:
        """Simple heuristic predictor when no model is available."""
        score = 0.05
        amount = float(features.get("Amount", features.get("amount", 0)))
        zscore = float(features.get("amount_zscore", 0))
        hour = int(features.get("transaction_hour", 12))

        if amount > 500:
            score += 0.2
        if amount > 1000:
            score += 0.2
        if abs(zscore) > 3:
            score += 0.3
        if hour in [0, 1, 2, 3, 23]:
            score += 0.1

        v1 = float(features.get("V1", features.get("v1", 0)))
        if v1 < -2:
            score += 0.2

        return min(score, 0.99)


# Singleton
_service_instance = None


def get_model_service() -> FraudModelService:
    global _service_instance
    if _service_instance is None:
        _service_instance = FraudModelService()
    return _service_instance
