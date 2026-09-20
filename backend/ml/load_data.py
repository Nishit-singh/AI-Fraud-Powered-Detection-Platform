"""
load_data.py — Phase 1: Data Ingestion
Loads the Kaggle Credit Card Fraud Detection dataset and prints key stats.

Dataset: creditcard.csv (284,807 transactions, 492 frauds)
Features: V1-V28 (PCA-transformed), Time, Amount, Class (0=normal, 1=fraud)

Place the file at: backend/data/creditcard.csv
Download from: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
"""

import sys
import os
import pandas as pd
import numpy as np

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "creditcard.csv")


def load_dataset(path: str = DATA_PATH) -> pd.DataFrame:
    """Load creditcard.csv and return a DataFrame."""
    path = os.path.abspath(path)
    if not os.path.exists(path):
        print("=" * 60)
        print("ERROR: creditcard.csv not found!")
        print(f"Expected location: {path}")
        print()
        print("To get the dataset:")
        print("  1. Go to: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud")
        print("  2. Download creditcard.csv (~144MB)")
        print(f"  3. Place it at: {path}")
        print()
        print("The API will run with synthetic data in the meantime.")
        print("=" * 60)
        sys.exit(1)

    print(f"Loading dataset from: {path}")
    df = pd.read_csv(path)
    return df


def print_stats(df: pd.DataFrame) -> None:
    """Print key statistics about the dataset."""
    print("\n" + "=" * 60)
    print("DATASET OVERVIEW")
    print("=" * 60)
    print(f"\nShape: {df.shape[0]:,} rows × {df.shape[1]} columns")

    # Class distribution
    fraud = df["Class"].value_counts()
    print("\nClass Distribution:")
    print(f"  Normal (0):  {fraud[0]:,}  ({fraud[0]/len(df)*100:.4f}%)")
    print(f"  Fraud  (1):  {fraud[1]:,}  ({fraud[1]/len(df)*100:.4f}%)")
    print(f"  Imbalance ratio: {fraud[0]/fraud[1]:.1f}:1")

    # Missing values
    missing = df.isnull().sum().sum()
    print(f"\nMissing Values: {missing}")

    # Amount stats
    print("\nAmount Statistics (by class):")
    print(df.groupby("Class")["Amount"].describe().round(2))

    # Time stats
    print("\nTime Statistics:")
    print(df["Time"].describe().round(2))
    print(f"  Duration: {df['Time'].max() / 3600:.1f} hours")

    print("\nFeatures: V1-V28 (PCA-transformed), Time, Amount, Class")
    print("=" * 60)


if __name__ == "__main__":
    df = load_dataset()
    print_stats(df)
