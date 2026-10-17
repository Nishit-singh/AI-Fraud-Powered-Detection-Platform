"""
model_service.py — Loads and serves the XGBoost fraud detection model.
Falls back to a mock predictor if the model file doesn't exist yet.
SHAP explanations are generated lazily on first use (TreeExplainer).
"""

import os
import json
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List

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

# Number of top SHAP contributors to return per direction
TOP_N_SHAP = 5


class FraudModelService:
    def __init__(self):
        self._model = None
        self._scaler = None
        self._feature_names = FEATURE_NAMES
        self._explainer = None          # lazy-loaded SHAP TreeExplainer
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

    def _get_explainer(self):
        """Lazy-load SHAP TreeExplainer on first explain() call."""
        if self._explainer is None and self._model is not None:
            try:
                import shap
                self._explainer = shap.TreeExplainer(self._model)
                print("[ModelService] SHAP TreeExplainer initialised.")
            except Exception as e:
                print(f"[ModelService] SHAP unavailable: {e}")
        return self._explainer

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

    def explain(self, features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Generate SHAP-based feature contributions for the given feature dict.
        Returns None if SHAP is unavailable or explanation fails — caller must handle.

        Uses the scaled feature vector (same as predict()) so SHAP values are
        consistent with actual model behaviour.
        """
        try:
            explainer = self._get_explainer()
            if explainer is None:
                return None

            # Build the same feature vector used in predict()
            amount = float(features.get("Amount", features.get("amount", 0)))
            if "transaction_hour" not in features:
                features = dict(features)
                features["transaction_hour"] = datetime.utcnow().hour
            if "amount_zscore" not in features:
                features = dict(features)
                features["amount_zscore"] = (amount - AMOUNT_MEAN) / AMOUNT_STD

            X = self._build_feature_vector(features)
            if self._scaler:
                X = self._scaler.transform(X)

            shap_values = explainer.shap_values(X)   # shape (1, n_features)
            sv = shap_values[0]                        # shape (n_features,)

            # Pair each feature with its SHAP value
            contributions = [
                {"feature": name, "shap": float(sv[i])}
                for i, name in enumerate(self._feature_names)
            ]

            # Positive SHAP → pushes toward fraud; negative → toward normal
            fraud_factors = sorted(
                [c for c in contributions if c["shap"] > 0],
                key=lambda x: x["shap"], reverse=True
            )[:TOP_N_SHAP]

            normal_factors = sorted(
                [c for c in contributions if c["shap"] < 0],
                key=lambda x: x["shap"]
            )[:TOP_N_SHAP]

            def label_strength(shap_abs: float) -> str:
                if shap_abs >= 1.5:
                    return "strong"
                elif shap_abs >= 0.5:
                    return "moderate"
                else:
                    return "weak"

            return {
                "top_fraud_factors": [
                    {
                        "feature": c["feature"],
                        "contribution": round(c["shap"], 4),
                        "strength": label_strength(abs(c["shap"])),
                    }
                    for c in fraud_factors
                ],
                "top_normal_factors": [
                    {
                        "feature": c["feature"],
                        "contribution": round(c["shap"], 4),
                        "strength": label_strength(abs(c["shap"])),
                    }
                    for c in normal_factors
                ],
                "note": (
                    "Feature contributions show which inputs influenced the model's "
                    "prediction. They do not represent independent causes of fraud."
                ),
            }

        except Exception as e:
            print(f"[ModelService] SHAP explanation failed: {e}")
            return None

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
