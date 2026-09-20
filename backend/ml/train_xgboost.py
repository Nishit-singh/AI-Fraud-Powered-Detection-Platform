"""
train_xgboost.py — Phase 2: XGBoost Classifier (Final Model)
Trains XGBoost using scale_pos_weight for imbalance (instead of SMOTE)
so we can compare both strategies. Includes hyperparameter tuning.

Key design choice — scale_pos_weight vs SMOTE:
  - SMOTE creates synthetic fraud samples, can introduce noise
  - scale_pos_weight adjusts the loss function to penalize missing frauds more
  - Both are valid; comparing them is a legitimate analytical contribution
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report
)
from xgboost import XGBClassifier

# Paths
BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "creditcard.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "fraud_xgb_model.pkl")
METRICS_PATH = os.path.join(BASE_DIR, "models", "xgboost_metrics.json")
BASELINE_PATH = os.path.join(BASE_DIR, "models", "baseline_metrics.json")
FEATURE_NAMES_PATH = os.path.join(BASE_DIR, "models", "feature_names.json")
os.makedirs(os.path.join(BASE_DIR, "models"), exist_ok=True)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add engineered features to improve recall:
    - transaction_hour: captures time-of-day fraud patterns
    - amount_zscore: flags unusually large/small transactions
    """
    df = df.copy()
    df["transaction_hour"] = (df["Time"] % 86400) // 3600
    df["amount_zscore"] = (df["Amount"] - df["Amount"].mean()) / df["Amount"].std()
    return df


def load_and_prepare(path: str):
    print("Loading dataset...")
    df = pd.read_csv(path)
    df = engineer_features(df)

    feature_cols = [c for c in df.columns if c not in ["Class", "Time"]]
    X = df[feature_cols].values
    y = df["Class"].values

    fraud_count = y.sum()
    normal_count = (y == 0).sum()
    scale_pos_weight = normal_count / fraud_count
    print(f"Class imbalance: {normal_count:,} normal vs {fraud_count:,} fraud")
    print(f"scale_pos_weight = {scale_pos_weight:.1f}")
    return X, y, feature_cols, scale_pos_weight


def train_xgboost(X, y, scale_pos_weight):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # No SMOTE here — using scale_pos_weight inside XGBoost instead
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    # Hyperparameter search space
    param_dist = {
        "max_depth": [3, 4, 5, 6, 7],
        "learning_rate": [0.01, 0.05, 0.1, 0.2],
        "n_estimators": [100, 200, 300],
        "subsample": [0.7, 0.8, 0.9, 1.0],
        "colsample_bytree": [0.7, 0.8, 0.9, 1.0],
        "min_child_weight": [1, 3, 5],
    }

    base_model = XGBClassifier(
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",  # area under precision-recall curve — better for imbalanced
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )

    print("\nRunning RandomizedSearchCV (10 iterations, 3-fold CV)...")
    search = RandomizedSearchCV(
        base_model,
        param_distributions=param_dist,
        n_iter=10,
        scoring="f1",
        cv=3,
        random_state=42,
        n_jobs=-1,
        verbose=1,
    )
    search.fit(X_train_sc, y_train)

    best_model = search.best_estimator_
    print(f"\nBest params: {search.best_params_}")

    y_pred = best_model.predict(X_test_sc)
    y_prob = best_model.predict_proba(X_test_sc)[:, 1]

    return best_model, scaler, X_test_sc, y_test, y_pred, y_prob, search.best_params_


def evaluate_and_compare(y_test, y_pred, y_prob, best_params):
    metrics = {
        "model": "XGBoost (scale_pos_weight + feature engineering)",
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "best_params": best_params,
    }

    print(f"\n{'='*60}")
    print("RESULTS: XGBoost")
    print(f"{'='*60}")
    print(f"  Precision : {metrics['precision']:.4f}")
    print(f"  Recall    : {metrics['recall']:.4f}")
    print(f"  F1 Score  : {metrics['f1']:.4f}")
    print(f"  ROC-AUC   : {metrics['roc_auc']:.4f}")

    # Side-by-side comparison
    if os.path.exists(BASELINE_PATH):
        with open(BASELINE_PATH) as f:
            baseline = json.load(f)
        print(f"\n{'='*60}")
        print("SIDE-BY-SIDE COMPARISON")
        print(f"{'='*60}")
        print(f"{'Metric':<15} {'Baseline (LR)':<20} {'XGBoost':<15} {'Winner'}")
        print("-" * 60)
        for m in ["precision", "recall", "f1", "roc_auc"]:
            b_val = baseline.get(m, 0)
            x_val = metrics[m]
            winner = "XGBoost ✓" if x_val > b_val else "Baseline ✓"
            print(f"{m:<15} {b_val:<20.4f} {x_val:<15.4f} {winner}")

        print(f"\n{'='*60}")
        print("ANALYSIS — Recall/Precision Tradeoff in Fraud Systems:")
        print(f"{'='*60}")
        print("""
  In fraud detection, the cost of missing a fraud (False Negative)
  vastly exceeds the cost of a false alarm (False Positive).
  
  HIGH RECALL = we catch most frauds (fewer missed frauds)
  HIGH PRECISION = fewer false alarms (fewer legitimate tx blocked)
  
  XGBoost with scale_pos_weight aggressively penalizes missing frauds,
  so it typically achieves higher recall at some precision cost.
  This tradeoff is acceptable in real fraud systems — banks prefer
  to review a few extra flagged transactions than miss actual fraud.
        """)

    return metrics


if __name__ == "__main__":
    if not os.path.exists(DATA_PATH):
        print(f"ERROR: Place creditcard.csv at {os.path.abspath(DATA_PATH)}")
        exit(1)

    X, y, feature_cols, scale_pos_weight = load_and_prepare(DATA_PATH)
    model, scaler, X_test, y_test, y_pred, y_prob, best_params = train_xgboost(
        X, y, scale_pos_weight
    )
    metrics = evaluate_and_compare(y_test, y_pred, y_prob, best_params)

    # Save model (scaler bundled so API can use it directly)
    artifact = {"model": model, "scaler": scaler, "feature_names": feature_cols}
    joblib.dump(artifact, MODEL_PATH)
    print(f"\nModel saved to: {MODEL_PATH}")

    # Save feature names
    with open(FEATURE_NAMES_PATH, "w") as f:
        json.dump(feature_cols, f, indent=2)

    # Save metrics
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics saved to: {METRICS_PATH}")
    print(f"\nClassification Report:\n{classification_report(y_test, y_pred, target_names=['Normal','Fraud'])}")
