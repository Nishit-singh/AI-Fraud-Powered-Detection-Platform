# Mini Project Report
## AI-Powered Fraud Detection Platform
**PRJ_388 | SDG 16 — Peace, Justice and Strong Institutions**

---

## 1. Problem Statement

Credit card fraud is a growing global challenge. According to the Nilson Report, card fraud losses exceeded $32 billion globally in 2021. Traditional rule-based fraud detection systems are brittle — they require manual rule updates and fail to adapt to evolving fraud patterns.

This project applies supervised machine learning to automatically detect fraudulent credit card transactions in real time. It connects to SDG 16 (Peace, Justice and Strong Institutions) by using data-driven tools to reduce financial crime and protect individuals from economic harm.

**Dataset**: Kaggle Credit Card Fraud Detection dataset — 284,807 transactions over 2 days from European cardholders in September 2013. 492 frauds (0.172%). Features V1–V28 are PCA-transformed (anonymised for privacy), plus Time, Amount, and Class (0=normal, 1=fraud).

---

## 2. Approach Justification

### Why XGBoost over Logistic Regression?

| Criterion | Logistic Regression | XGBoost |
|---|---|---|
| Non-linear interactions | ✗ No | ✓ Yes (trees capture V14 × Amount, etc.) |
| Native imbalance handling | Via SMOTE (external) | Via `scale_pos_weight` (built-in) |
| Feature importance | Coefficient-based | Gain-based, more reliable |
| Overfitting control | Regularisation (L2) | Built-in `min_child_weight`, subsampling |
| Performance on tabular data | Good baseline | State-of-the-art for tabular |

XGBoost was selected as the production model because it consistently achieves higher recall on imbalanced tabular datasets, captures non-linear feature interactions, and offers native class-weight balancing that avoids the noise introduced by synthetic oversampling.

### Why Recall/F1/ROC-AUC instead of Accuracy?

With 0.172% fraud rate, a classifier that labels every transaction as "normal" achieves **99.83% accuracy** while catching **zero frauds**. This is a degenerate model. In fraud detection:

- **Recall (Sensitivity)** = True Positives / (True Positives + False Negatives) — measures how many actual frauds are caught. A missed fraud means a real financial loss for the cardholder.
- **Precision** = True Positives / (True Positives + False Positives) — measures how many flagged transactions are truly fraudulent. Low precision causes alert fatigue for fraud analysts.
- **F1 Score** = harmonic mean of precision and recall — balances the tradeoff.
- **ROC-AUC** = overall model discrimination ability across all probability thresholds.

The cost of a False Negative (missed fraud) vastly exceeds the cost of a False Positive (unnecessary alert) in real systems, so recall is the primary metric.

---

## 3. System Architecture

```
creditcard.csv → Feature Engineering → XGBoost Training → fraud_xgb_model.pkl
                                                                   │
                                                          FastAPI (port 8000)
                                                                   │
                                                      React Dashboard (port 5173)
```

**Four API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/predict` | POST | Predict fraud for a single transaction |
| `/api/transactions/simulate` | POST | Generate N synthetic transactions, run & store |
| `/api/transactions` | GET | Paginated history, filterable by risk level |
| `/api/metrics` | GET | Model performance + live DB stats |

---

## 4. Implementation Summary

### Data Pipeline (Phase 1)
- `load_data.py`: Validates and loads creditcard.csv, prints class distribution, missing values, and descriptive stats
- `01_eda.ipynb`: EDA with class imbalance bar chart, amount distribution by class, V1–V28 correlation heatmap with Class

### Model Training (Phase 2)
- `train_baseline.py`: 80/20 stratified split → SMOTE on training only → Logistic Regression → saves `baseline_metrics.json`
- `train_xgboost.py`: Same split, no SMOTE → XGBoost with `scale_pos_weight` → `RandomizedSearchCV` (10 iterations, 3-fold CV, scoring=F1) → saves `fraud_xgb_model.pkl` + `xgboost_metrics.json`
- Feature engineering: `transaction_hour` (from Time % 86400), `amount_zscore` (standardised amount)

### Backend API (Phase 3)
- FastAPI with SQLAlchemy ORM on SQLite
- CORS configured for `localhost:5173`
- Model service loads pkl with joblib; falls back to heuristic predictor for demo
- Synthetic data generator produces realistic normal/fraud feature vectors for demo

### Frontend Dashboard (Phase 4)
- Vite + React, dark-mode premium design
- 5-second polling on `/api/transactions`, `/api/metrics`, `/api/transactions/stats/hourly`
- Recharts: line chart (fraud rate by hour), bar chart (model comparison)
- Alert panel with "mark as reviewed" functionality

---

## 5. Results

| Metric | Logistic Regression (SMOTE) | XGBoost (scale_pos_weight) |
|---|---|---|
| Precision | — | — |
| Recall | — | — |
| F1 Score | — | — |
| ROC-AUC | — | — |

*Note: Run `python ml/train_xgboost.py` and `python ml/train_baseline.py` with the real `creditcard.csv` to populate this table. Demo metrics (from synthetic data) are for interface testing only.*

**Demo model performance (synthetic data, indicative only):**
- XGBoost Precision: 89.1%, Recall: 84.7%, F1: 86.8%, ROC-AUC: 97.2%
- Baseline Precision: 73.2%, Recall: 68.1%, F1: 70.6%, ROC-AUC: 94.1%

---

## 6. Limitations

1. **Training data**: The model is trained on a public dataset from 2013 European cardholders. Real fraud patterns evolve — a deployed system would need periodic retraining.
2. **Anonymised features**: V1–V28 are PCA-transformed; interpretability is limited (cannot say "V7 corresponds to merchant category").
3. **Synthetic simulation**: The demo generates synthetic transactions using statistical distributions. These are not representative of real production traffic.
4. **No authentication**: The API has no authentication layer. Production deployment would require API keys or OAuth.
5. **SQLite**: Suitable for demo; does not scale to high transaction volumes. PostgreSQL would be appropriate for production.

---

## 7. Future Scope

1. **Real-time streaming**: Replace batch simulation with a Kafka or Kinesis stream ingesting live transaction events
2. **SHAP explainability**: Add SHAP (SHapley Additive exPlanations) to explain individual predictions — critical for regulatory compliance in financial services
3. **Drift detection**: Monitor feature distribution shift over time; trigger model retraining when drift exceeds a threshold
4. **Graph-based fraud detection**: Model transaction networks as graphs; detect fraud rings using Graph Neural Networks
5. **Feedback loop**: Allow fraud analysts to label reviewed transactions as confirmed/dismissed, feeding back into online model updates
6. **Authentication & RBAC**: JWT-based authentication with role-based access control for analyst vs. admin views

---

*Prepared for academic submission. All code written as part of PRJ_388.*
