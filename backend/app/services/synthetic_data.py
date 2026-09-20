"""
synthetic_data.py — Generates realistic synthetic transactions for the demo.
Produces a realistic mix: ~1-3% fraudulent, rest normal.
"""

import random
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any


AMOUNT_MEAN = 88.35
AMOUNT_STD = 250.12


def _random_normal_transaction(rng: np.random.RandomState) -> Dict[str, Any]:
    """Generate a normal (non-fraud) transaction feature vector."""
    amount = max(0.01, abs(rng.normal(80, 150)))
    hour = int(rng.choice(range(6, 24), p=None))

    features = {}
    for i in range(1, 29):
        features[f"v{i}"] = float(rng.normal(0, 1))

    # Typical normal patterns
    features["v1"] = float(rng.normal(1.5, 1.2))
    features["v2"] = float(rng.normal(0.5, 1.0))
    features["amount"] = round(amount, 2)
    features["transaction_hour"] = hour
    features["amount_zscore"] = (amount - AMOUNT_MEAN) / AMOUNT_STD

    return features


def _random_fraud_transaction(rng: np.random.RandomState) -> Dict[str, Any]:
    """Generate a fraudulent transaction feature vector with fraud signatures."""
    # Fraud often: late night, unusual amounts, shifted PCA components
    amount = max(0.01, abs(rng.normal(300, 400)))
    hour = int(rng.choice([0, 1, 2, 3, 23], p=[0.25, 0.25, 0.2, 0.2, 0.1]))

    features = {}
    for i in range(1, 29):
        features[f"v{i}"] = float(rng.normal(0, 2))

    # Fraud signatures from real dataset correlations
    features["v1"] = float(rng.normal(-4, 1.5))   # strongly negative for fraud
    features["v4"] = float(rng.normal(3, 1.2))    # strongly positive for fraud
    features["v10"] = float(rng.normal(-4, 1.2))  # strongly negative for fraud
    features["v12"] = float(rng.normal(-4, 1.5))  # strongly negative for fraud
    features["v14"] = float(rng.normal(-5, 1.0))  # most discriminative
    features["amount"] = round(amount, 2)
    features["transaction_hour"] = hour
    features["amount_zscore"] = (amount - AMOUNT_MEAN) / AMOUNT_STD

    return features


def generate_transactions(n: int = 20, fraud_rate: float = 0.15, seed: int = None) -> List[Dict[str, Any]]:
    """
    Generate N synthetic transactions.
    fraud_rate: fraction that will be fraud-like (higher than real for demo visibility)
    """
    if seed is None:
        seed = random.randint(0, 99999)
    rng = np.random.RandomState(seed)

    transactions = []
    n_fraud = max(1, int(n * fraud_rate))
    n_normal = n - n_fraud

    for _ in range(n_normal):
        transactions.append({"features": _random_normal_transaction(rng), "label": 0})
    for _ in range(n_fraud):
        transactions.append({"features": _random_fraud_transaction(rng), "label": 1})

    rng.shuffle(transactions)
    return transactions
