# System Architecture — AI-Powered Fraud Detection Platform

## Data Flow

```
creditcard.csv (Kaggle, 284,807 transactions)
        │
        ▼
 backend/ml/load_data.py
 ┌──────────────────────────────┐
 │  Feature Engineering         │
 │  - transaction_hour          │
 │  - amount_zscore             │
 │  - V1-V28 (PCA, raw)        │
 └──────────┬───────────────────┘
            │
            ▼
 ┌──────────────────────────────┐
 │  train_baseline.py           │
 │  LogisticRegression + SMOTE  │──→ baseline_metrics.json
 └──────────────────────────────┘
            │
            ▼
 ┌──────────────────────────────┐
 │  train_xgboost.py            │
 │  XGBoost + scale_pos_weight  │──→ fraud_xgb_model.pkl
 │  RandomizedSearchCV (tuning) │──→ xgboost_metrics.json
 └──────────┬───────────────────┘
            │
            ▼
 ┌────────────────────────────────────────────────────┐
 │  FastAPI Backend (localhost:8000)                  │
 │                                                    │
 │  app/services/model_service.py                     │
 │    └── loads fraud_xgb_model.pkl via joblib        │
 │                                                    │
 │  app/api/predict.py                                │
 │    POST /api/predict → {is_fraud, probability,     │
 │                          risk_level}               │
 │                                                    │
 │  app/api/transactions.py                           │
 │    POST /api/transactions/simulate                 │
 │      → synthetic_data.py → model → SQLite DB      │
 │    GET  /api/transactions                          │
 │      → paginated history, filterable               │
 │    GET  /api/transactions/stats/hourly             │
 │      → hour-bucketed fraud rate                    │
 │                                                    │
 │  app/api/metrics.py                                │
 │    GET  /api/metrics                               │
 │      → model metrics + live DB stats              │
 │                                                    │
 │  SQLite (fraud_detection.db)                       │
 │    └── Transaction table: amount, V1-V28,          │
 │        is_fraud, fraud_probability, risk_level,    │
 │        reviewed, transaction_hour                  │
 └────────────────────────┬───────────────────────────┘
                          │ HTTP/JSON (CORS)
                          ▼
 ┌────────────────────────────────────────────────────┐
 │  React Dashboard (localhost:5173, Vite)            │
 │                                                    │
 │  App.jsx                                           │
 │    ├── polls /api/transactions every 5s            │
 │    ├── polls /api/metrics every 5s                 │
 │    └── polls /api/transactions/stats/hourly        │
 │                                                    │
 │  Components:                                       │
 │    ├── Navbar          – brand + API status badge  │
 │    ├── SummaryCards    – 6 KPI cards               │
 │    ├── TransactionFeed – live table, filter chips  │
 │    │                    Simulate button            │
 │    ├── AlertsPanel     – high-risk only, review    │
 │    └── Charts          – recharts                  │
 │         ├── FraudRateChart (line, by hour)         │
 │         └── ModelPerformanceChart (bar, XGB vs LR) │
 └────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Technology | Responsibility |
|---|---|---|
| Data ingestion | Python / pandas | Load & validate creditcard.csv |
| Feature engineering | pandas / numpy | Extract hour, z-score |
| Baseline model | scikit-learn LR + SMOTE | Benchmark metrics |
| Production model | XGBoost + scale_pos_weight | Serving predictions |
| Model serving | joblib | Load/cache pkl artifact |
| REST API | FastAPI + uvicorn | Expose 4 endpoints |
| Database | SQLite + SQLAlchemy | Persist transaction predictions |
| Synthetic data | numpy random | Demo without real dataset |
| Frontend | React + Vite | Live dashboard UI |
| Charts | recharts | Fraud rate timeline, model comparison |

## Key Design Decisions

### Why XGBoost over Logistic Regression?
- Captures non-linear feature interactions (e.g., V14 × Amount)
- Native imbalance handling via `scale_pos_weight`
- Robust to outliers in Amount/V features
- Consistently outperforms LR on tabular fraud datasets

### Why ROC-AUC + Recall, not Accuracy?
With 0.17% fraud rate, a "predict everything normal" model achieves **99.83% accuracy** but **0% recall** — it's useless. We track:
- **Recall**: fraction of frauds caught (missed fraud = real financial loss)
- **Precision**: fraction of fraud flags that are real (too low = alert fatigue)
- **F1**: harmonic mean, balances the tradeoff
- **ROC-AUC**: model's overall discriminative power

### Why SQLite?
Simple, zero-config, ideal for demo/prototype. SQLAlchemy ORM means upgrading to PostgreSQL is one env-var change.

### Why SMOTE (baseline) vs scale_pos_weight (XGBoost)?
Comparing two strategies is a valid analytical contribution for the viva:
- SMOTE: generates synthetic minority samples — can introduce noise
- scale_pos_weight: adjusts the XGBoost loss function — no synthetic data

## File Structure

```
fraud-detection-platform/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app, lifespan, CORS
│   │   ├── models/
│   │   │   ├── transaction.py        # SQLAlchemy ORM
│   │   │   └── database.py           # Engine, SessionLocal, create_tables
│   │   ├── api/
│   │   │   ├── predict.py            # POST /api/predict
│   │   │   ├── transactions.py       # GET/POST /api/transactions
│   │   │   └── metrics.py            # GET /api/metrics
│   │   └── services/
│   │       ├── model_service.py      # Loads pkl, predict(), heuristic fallback
│   │       └── synthetic_data.py     # Generates fake transactions for demo
│   ├── ml/
│   │   ├── load_data.py              # Dataset loading + stats
│   │   ├── train_baseline.py         # Logistic Regression + SMOTE
│   │   ├── train_xgboost.py          # XGBoost + RandomizedSearchCV
│   │   ├── generate_mock_model.py    # Demo model (no creditcard.csv needed)
│   │   ├── notebooks/
│   │   │   └── 01_eda.ipynb          # EDA: imbalance, correlations, amounts
│   │   └── models/
│   │       ├── fraud_xgb_model.pkl   # Trained model artifact
│   │       ├── feature_names.json
│   │       ├── xgboost_metrics.json
│   │       └── baseline_metrics.json
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx                   # Root, polling, state
        ├── api.js                    # API client
        ├── index.css                 # Design system
        └── components/
            ├── Navbar.jsx
            ├── SummaryCards.jsx
            ├── TransactionFeed.jsx
            ├── AlertsPanel.jsx
            └── Charts.jsx
```
