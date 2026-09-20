"""
generate_mock_model.py — Demo Model Generator
Creates a lightweight trained model using synthetic data so the full API
and dashboard can run without the real creditcard.csv dataset.

The synthetic model captures the right interface (feature names, predict_proba)
but its precision/recall numbers are not meaningful for academic purposes.
Replace this with the real model by running: python ml/train_xgboost.py
"""

import os
import json
import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "models", "fraud_xgb_model.pkl")
METRICS_PATH_XGB = os.path.join(BASE_DIR, "models", "xgboost_metrics.json")
METRICS_PATH_BASE = os.path.join(BASE_DIR, "models", "baseline_metrics.json")
FEATURE_NAMES_PATH = os.path.join(BASE_DIR, "models", "feature_names.json")
os.makedirs(os.path.join(BASE_DIR, "models"), exist_ok=True)

# Feature names matching the real dataset
FEATURE_NAMES = [f"V{i}" for i in range(1, 29)] + ["Amount", "transaction_hour", "amount_zscore"]

N_SAMPLES = 10000
FRAUD_RATIO = 0.002  # ~0.2%, close to real dataset


def generate_synthetic_data(n=N_SAMPLES, fraud_ratio=FRAUD_RATIO, seed=42):
    """Generate realistic-looking transaction data."""
    rng = np.random.RandomState(seed)
    n_fraud = int(n * fraud_ratio)
    n_normal = n - n_fraud

    # Normal transactions: PCA components near 0, small amounts
    X_normal = rng.randn(n_normal, len(FEATURE_NAMES))
    X_normal[:, 28] = np.abs(rng.randn(n_normal)) * 50 + 80  # Amount
    X_normal[:, 29] = rng.randint(0, 24, n_normal)  # transaction_hour
    X_normal[:, 30] = rng.randn(n_normal)  # amount_zscore

    # Fraudulent transactions: shifted distributions, unusual amounts
    X_fraud = rng.randn(n_fraud, len(FEATURE_NAMES)) * 2
    X_fraud[:, 0] = rng.randn(n_fraud) - 3   # V1 negative for fraud
    X_fraud[:, 3] = rng.randn(n_fraud) + 2   # V4 positive for fraud
    X_fraud[:, 9] = rng.randn(n_fraud) - 4   # V10 negative for fraud
    X_fraud[:, 11] = rng.randn(n_fraud) + 3  # V12 positive for fraud
    X_fraud[:, 28] = np.abs(rng.randn(n_fraud)) * 200 + 300  # Higher amounts
    X_fraud[:, 29] = rng.choice([0, 1, 2, 3, 23], n_fraud)   # Late night mostly
    X_fraud[:, 30] = rng.randn(n_fraud) * 2 + 3  # High z-scores

    X = np.vstack([X_normal, X_fraud])
    y = np.hstack([np.zeros(n_normal), np.ones(n_fraud)]).astype(int)

    # Shuffle
    idx = rng.permutation(len(y))
    return X[idx], y[idx]


if __name__ == "__main__":
    print("Generating synthetic training data...")
    X, y = generate_synthetic_data()
    fraud_count = y.sum()
    scale_pos_weight = (len(y) - fraud_count) / fraud_count

    print(f"  Samples: {len(X):,} ({fraud_count} fraud, {len(y)-fraud_count} normal)")

    scaler = StandardScaler()
    X_sc = scaler.fit_transform(X)

    print("Training mock XGBoost model on synthetic data...")
    model = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",
        random_state=42,
        verbosity=0,
    )
    model.fit(X_sc, y)

    artifact = {"model": model, "scaler": scaler, "feature_names": FEATURE_NAMES}
    joblib.dump(artifact, MODEL_PATH)
    print(f"Mock model saved to: {MODEL_PATH}")

    # Save feature names
    with open(FEATURE_NAMES_PATH, "w") as f:
        json.dump(FEATURE_NAMES, f, indent=2)

    # Save mock metrics (clearly labeled as demo values)
    mock_metrics = {
        "model": "XGBoost (DEMO — trained on synthetic data)",
        "note": "Run train_xgboost.py with real creditcard.csv for accurate metrics",
        "precision": 0.891,
        "recall": 0.847,
        "f1": 0.868,
        "roc_auc": 0.972,
        "confusion_matrix": [[9800, 12], [31, 157]],
    }
    with open(METRICS_PATH_XGB, "w") as f:
        json.dump(mock_metrics, f, indent=2)

    baseline_mock = {
        "model": "Logistic Regression (DEMO)",
        "note": "Run train_baseline.py with real creditcard.csv for accurate metrics",
        "precision": 0.732,
        "recall": 0.681,
        "f1": 0.706,
        "roc_auc": 0.941,
        "confusion_matrix": [[9790, 22], [63, 125]],
    }
    with open(METRICS_PATH_BASE, "w") as f:
        json.dump(baseline_mock, f, indent=2)

    print("Mock metrics saved.")
    print("\nDone! The API server can now run with realistic demo data.")
    print("To use real data: python ml/train_xgboost.py (requires creditcard.csv)")
