"""
train_baseline.py — Phase 2: Logistic Regression Baseline
Trains a Logistic Regression classifier with SMOTE for class imbalance.

NOTE ON METRICS:
  Plain "accuracy" is NOT reported as the headline metric for this dataset.
  With 99.83% normal transactions, a model that predicts everything as normal
  achieves 99.83% accuracy while catching ZERO frauds — completely useless.
  Instead we use: Precision, Recall, F1, ROC-AUC, and Confusion Matrix.
  Recall (how many frauds we catch) is the most critical metric in fraud detection.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report
)
from imblearn.over_sampling import SMOTE

# Paths
BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "creditcard.csv")
METRICS_PATH = os.path.join(BASE_DIR, "models", "baseline_metrics.json")
os.makedirs(os.path.join(BASE_DIR, "models"), exist_ok=True)


def load_and_prepare(path: str):
    print("Loading dataset...")
    df = pd.read_csv(path)

    # Feature engineering
    df["transaction_hour"] = (df["Time"] % 86400) // 3600
    df["amount_zscore"] = (df["Amount"] - df["Amount"].mean()) / df["Amount"].std()

    feature_cols = [c for c in df.columns if c not in ["Class", "Time"]]
    X = df[feature_cols].values
    y = df["Class"].values
    return X, y, feature_cols


def train_baseline(X, y):
    # 80/20 stratified split (keep class ratio in both sets)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale features
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    # SMOTE applied ONLY on training set (never touch the test set)
    print("Applying SMOTE to training set...")
    sm = SMOTE(random_state=42, n_jobs=-1)
    X_resampled, y_resampled = sm.fit_resample(X_train_sc, y_train)
    print(f"  After SMOTE: {y_resampled.sum():,} fraud samples in training")

    # Train Logistic Regression
    print("Training Logistic Regression...")
    model = LogisticRegression(max_iter=1000, random_state=42, n_jobs=-1)
    model.fit(X_resampled, y_resampled)

    # Evaluate on UNTOUCHED test set
    y_pred = model.predict(X_test_sc)
    y_prob = model.predict_proba(X_test_sc)[:, 1]

    return model, scaler, X_test_sc, y_test, y_pred, y_prob


def evaluate(y_test, y_pred, y_prob, model_name="Logistic Regression (SMOTE)"):
    metrics = {
        "model": model_name,
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "test_size": int(len(y_test)),
        "fraud_in_test": int(y_test.sum()),
    }

    print(f"\n{'='*60}")
    print(f"RESULTS: {model_name}")
    print(f"{'='*60}")
    print(f"  Precision : {metrics['precision']:.4f}")
    print(f"  Recall    : {metrics['recall']:.4f}  ← most critical for fraud")
    print(f"  F1 Score  : {metrics['f1']:.4f}")
    print(f"  ROC-AUC   : {metrics['roc_auc']:.4f}")
    print(f"\nConfusion Matrix:")
    cm = metrics["confusion_matrix"]
    print(f"  TN={cm[0][0]:,}  FP={cm[0][1]:,}")
    print(f"  FN={cm[1][0]:,}  TP={cm[1][1]:,}")
    print(f"\nFull Report:\n{classification_report(y_test, y_pred, target_names=['Normal','Fraud'])}")
    return metrics


if __name__ == "__main__":
    if not os.path.exists(DATA_PATH):
        print(f"ERROR: Place creditcard.csv at {os.path.abspath(DATA_PATH)}")
        exit(1)

    X, y, features = load_and_prepare(DATA_PATH)
    model, scaler, X_test, y_test, y_pred, y_prob = train_baseline(X, y)
    metrics = evaluate(y_test, y_pred, y_prob)

    # Save metrics
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nMetrics saved to: {METRICS_PATH}")
