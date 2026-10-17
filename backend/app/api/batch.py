"""
batch.py — POST /api/predict/batch
Accepts a CSV file upload, runs every row through the XGBoost model,
persists each prediction as a Transaction with source="csv", and returns a summary.

Validation rules:
- Required columns: Amount + V1-V28 (case-insensitive match)
- Rejects empty files (0 data rows)
- Caps at MAX_ROWS (5,000) — returns 400 if exceeded
- On column-validation failure: returns 400, NO partial DB writes
- Row-level parse errors are collected in `errors` list; valid rows still proceed
"""

import io
from datetime import datetime
from typing import List

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.transaction import Transaction
from app.services.model_service import get_model_service

router = APIRouter()

MAX_ROWS = 5_000

# Required columns (lowercase for case-insensitive comparison)
REQUIRED_COLS = {"amount"} | {f"v{i}" for i in range(1, 29)}


@router.post(
    "/predict/batch",
    summary="Batch CSV fraud prediction",
    tags=["Prediction"],
)
async def predict_batch(
    file: UploadFile = File(..., description="CSV with columns: Amount, V1-V28"),
    db: Session = Depends(get_db),
):
    """
    Upload a CSV file with columns `Amount` and `V1`–`V28` (case-insensitive).
    Each row is run through the XGBoost model and saved to the database with
    `source="csv"`, `is_simulated=False`.

    Returns a summary:
    ```json
    {
      "total_rows": 100,
      "processed": 99,
      "fraud_flagged": 12,
      "normal": 87,
      "errors": [{"row": 5, "reason": "..."}]
    }
    ```
    """
    # ── 1. Read raw bytes ────────────────────────────────────────────────────
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── 2. Parse CSV ─────────────────────────────────────────────────────────
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows.")

    # ── 3. Validate columns (case-insensitive) ────────────────────────────────
    df.columns = [c.strip() for c in df.columns]  # strip whitespace
    col_lower = {c.lower(): c for c in df.columns}
    missing = REQUIRED_COLS - set(col_lower.keys())
    if missing:
        sorted_missing = sorted(missing, key=lambda x: (len(x), x))
        raise HTTPException(
            status_code=400,
            detail=(
                f"CSV is missing {len(missing)} required column(s): "
                f"{', '.join(sorted_missing)}. "
                f"Required: Amount, V1-V28."
            ),
        )

    # ── 4. Row cap ────────────────────────────────────────────────────────────
    if len(df) > MAX_ROWS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"CSV contains {len(df):,} rows which exceeds the limit of "
                f"{MAX_ROWS:,}. Please split into smaller files."
            ),
        )

    # ── 5. Normalise column names to canonical form (Amount, V1…V28) ─────────
    rename_map = {}
    for canonical in ["Amount"] + [f"V{i}" for i in range(1, 29)]:
        lower = canonical.lower()
        if lower in col_lower:
            rename_map[col_lower[lower]] = canonical
    df = df.rename(columns=rename_map)

    # ── 6. Process rows ───────────────────────────────────────────────────────
    service = get_model_service()
    errors: List[dict] = []
    rows_to_commit: List[Transaction] = []
    fraud_flagged = 0
    processed = 0

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # 1-based, accounting for header
        try:
            features = {
                "amount": float(row["Amount"]),
                **{f"v{i}": float(row[f"V{i}"]) for i in range(1, 29)},
            }
        except (ValueError, KeyError) as exc:
            errors.append({"row": row_num, "reason": f"Parse error: {exc}"})
            continue

        try:
            result = service.predict(features)
        except Exception as exc:
            errors.append({"row": row_num, "reason": f"Prediction error: {exc}"})
            continue

        tx = Transaction(
            transaction_time=datetime.utcnow(),
            amount=features["amount"],
            is_fraud=result["is_fraud"],
            fraud_probability=result["fraud_probability"],
            risk_level=result["risk_level"],
            transaction_hour=features.get("transaction_hour"),
            amount_zscore=features.get("amount_zscore"),
            is_simulated=False,
            source="csv",
            reviewed=False,
        )
        for i in range(1, 29):
            setattr(tx, f"v{i}", features.get(f"v{i}", 0.0))

        rows_to_commit.append(tx)
        processed += 1
        if result["is_fraud"]:
            fraud_flagged += 1

    # ── 7. Commit all valid rows in one transaction ───────────────────────────
    if rows_to_commit:
        db.add_all(rows_to_commit)
        db.commit()

    return {
        "total_rows": len(df),
        "processed": processed,
        "fraud_flagged": fraud_flagged,
        "normal": processed - fraud_flagged,
        "errors": errors,
    }
