# Antigravity Implementation Prompts
Repo: https://github.com/Nishit-singh/AI-Fraud-Powered-Detection-Platform
Dataset: already at `backend/data/creditcard.csv` (gitignored, do not touch this file or re-download it)

---

## PROMPT 1 — Train on the real Kaggle dataset

Inspect `backend/ml/train_baseline.py` and `backend/ml/train_xgboost.py` before changing anything — both scripts are already correctly wired to read `backend/data/creditcard.csv`, engineer `transaction_hour` and `amount_zscore`, apply SMOTE only to the Logistic Regression baseline, and use `scale_pos_weight` only for XGBoost. Do not rewrite the pipeline logic.

The file `backend/data/creditcard.csv` already exists locally. Do not ask the user to download it, do not generate a synthetic replacement, and do not commit it (it's already in `.gitignore`).

Tasks:
1. Run `python backend/ml/train_baseline.py`, confirm it completes and writes `backend/ml/models/baseline_metrics.json`.
2. Run `python backend/ml/train_xgboost.py`, confirm it writes `backend/ml/models/fraud_xgb_model.pkl`, `feature_names.json`, and `xgboost_metrics.json`.
3. Open both resulting JSON files and confirm the `"model"` field no longer says "DEMO" and the `"note"` field about synthetic data is gone (this happens automatically since the real scripts don't write those fields — just verify).
4. Do NOT modify `backend/ml/generate_mock_model.py` — leave it as a fallback/demo generator, just don't run it again.
5. Report the final precision/recall/F1/ROC-AUC for both models and confirm `backend/ml/models/fraud_xgb_model.pkl` exists on disk.

Acceptance criteria:
- `fraud_xgb_model.pkl`, `baseline_metrics.json`, `xgboost_metrics.json` are all freshly generated from the real dataset (check file timestamps).
- Metrics are not the demo values (precision 0.891/0.732 etc. — those are the mock numbers, they should differ).
- No changes made to the training script logic itself.

---

## PROMPT 2 — Verify model loading and inference

Inspect `backend/app/services/model_service.py` first. It already loads `fraud_xgb_model.pkl` via joblib and falls back to a heuristic if the file is missing — do not change this fallback logic, only verify the real path works now.

Tasks:
1. Start the backend (`uvicorn app.main:app` from `backend/`) and confirm the startup log prints `[ModelService] Loaded model from ...` (not the "No model" warning).
2. Call `POST /api/predict` via `/docs` with a sample transaction (Amount + V1-V28) and confirm the response uses the real model, not the heuristic fallback (check `_heuristic_predict` is not being hit — add a temporary print if needed, then remove it).
3. Confirm `GET /api/metrics` returns the real precision/recall/F1/ROC-AUC values from PROMPT 1, not the old demo values.

Acceptance criteria:
- Model loads without errors at startup.
- `/api/predict` and `/api/metrics` both reflect the real trained model.
- No changes to `model_service.py`'s public interface (`predict()` signature must stay the same — other files depend on it).

---

## PROMPT 3 — Persist every prediction to the database

Inspect `backend/app/models/transaction.py` first — the schema already has every field needed (`source`, `is_simulated`, `reviewed`, `risk_level`, `v1`-`v28`, `transaction_hour`, `amount_zscore`). Do not create a new table or add columns unless you find a genuine gap after inspecting.

The actual gap: `backend/app/api/predict.py`'s `POST /api/predict` currently returns a prediction but never writes a `Transaction` row. `backend/app/api/transactions.py`'s `/transactions/simulate` already does this correctly — use it as the pattern.

Tasks:
1. In `backend/app/api/predict.py`, add a `db: Session = Depends(get_db)` parameter to the `predict` endpoint (import `get_db` from `app.models.database` and `Transaction` from `app.models.transaction`, same as `transactions.py` does).
2. After getting the prediction result, build and commit a `Transaction` row: `source="manual"`, `is_simulated=False`, copy `amount`, `v1`-`v28`, `transaction_hour`, `amount_zscore` from the input, and `is_fraud`/`fraud_probability`/`risk_level` from the prediction result.
3. Update `Transaction.source`'s column comment/default context (currently `"simulate" | "api"` in the docstring) to also allow `"manual"` and `"csv"` — just update the comment, the column is already a plain `String(20)` so no migration needed.
4. Do not change the `PredictionResponse` shape returned to the client — the frontend expects `{is_fraud, fraud_probability, risk_level}` unchanged.

Acceptance criteria:
- Every call to `POST /api/predict` creates exactly one new row in the `transactions` table with `source="manual"`.
- `GET /api/transactions` and `GET /api/metrics` totals increase after a manual prediction.
- Existing `/transactions/simulate` behavior is completely unchanged.
- Test: call `/api/predict` three times, then `GET /api/transactions`, confirm three new rows with `source="manual"`.

---

## PROMPT 4 — Fix the hourly fraud chart

Inspect `backend/app/api/transactions.py`, function `hourly_fraud_stats` (around line 165-194) before editing.

The bug: `func.sum(Transaction.is_fraud.cast(int)).label("fraud_count")` uses Python's built-in `int`, which is not a valid SQLAlchemy type for `.cast()`. This silently produces wrong or null results depending on the DB backend.

Tasks:
1. Add `from sqlalchemy import Integer` to the imports in `transactions.py` (alongside the existing `from sqlalchemy import desc`).
2. Replace `Transaction.is_fraud.cast(int)` with `Transaction.is_fraud.cast(Integer)`.
3. Test with an empty database (fresh `fraud_detection.db` or delete the existing one) — confirm `GET /api/transactions/stats/hourly` returns `{"data": []}` without a 500 error.
4. Test with data (run a simulation first) — confirm each hour bucket has correct `total`, `fraud`, and `fraud_rate` values that you can verify by manually counting rows for that hour.

Acceptance criteria:
- No `.cast(int)` remains anywhere in the codebase (grep to confirm).
- Endpoint returns correct, non-null fraud counts per hour.
- Frontend's `FraudRateChart` (in `frontend/src/components/Charts.jsx`) renders without errors using this data — no frontend changes needed if the backend fix is correct, since `api.js`'s `getHourlyStats()` is already wired.

---

## PROMPT 5 — Add react-router-dom and page shell

Inspect `frontend/src/App.jsx`, `frontend/package.json`, and `frontend/src/components/Navbar.jsx` first. Currently there is no routing — everything renders in one view, and `Navbar.jsx` has no nav links.

Tasks:
1. Add `react-router-dom` (`^7.x`, matching React 19 compatibility) to `frontend/package.json` dependencies and run `npm install` in `frontend/`.
2. Wrap the app in `<BrowserRouter>` inside `frontend/src/main.jsx` — inspect it first to see the current render call.
3. Create a new `frontend/src/pages/` directory. Move the current dashboard content out of `App.jsx` into `frontend/src/pages/Dashboard.jsx` unchanged (same components, same polling logic) — `App.jsx` becomes just the `<Routes>` definition.
4. Add route stubs (content built in later prompts) for: `/predict`, `/transactions`, `/transactions/fraud`, `/transactions/normal`, `/transactions/high-risk`, `/analytics`.
5. Update `Navbar.jsx` to add `<Link>` elements (from `react-router-dom`) for: Dashboard, Predict Transaction, All Transactions, Fraud, High Risk Alerts, Analytics — using the existing navbar CSS classes in `index.css`, don't invent new class names without checking what's already styled.

Acceptance criteria:
- App still runs and the existing dashboard is reachable at `/` with zero behavior change.
- All nav links render and navigate without a full page reload.
- No existing component's props or polling logic changed, only relocated.

---

## PROMPT 6 — Manual Prediction page

Inspect `frontend/src/api.js` (the `predict` function already exists and is correctly wired to `POST /api/predict`) and `backend/app/api/predict.py`'s `TransactionInput` schema before building the form, so field names match exactly (`Amount`, `V1`...`V28`, capitalized).

Tasks:
1. Create `frontend/src/pages/Predict.jsx`. Build a form with an `Amount` input and 28 `V1`-`V28` numeric inputs (default all V-fields to `0`, since the backend already defaults them — don't force the user to fill all 28 by hand for every test; consider a compact grid layout, not 29 stacked rows).
2. Do NOT ask the user to input `transaction_hour` or `amount_zscore` — `model_service.py` already computes these server-side when absent.
3. On submit, call `api.predict(formValues)`. Display the result using existing card/badge CSS patterns from `index.css` (check what's already there for risk-level colors before inventing new ones): Fraud Probability (%), Prediction (FRAUD/NORMAL), Risk Level (LOW/MEDIUM/HIGH).
4. Add a "Fill sample fraud-like values" and "Fill sample normal values" quick-fill button using patterns similar to `backend/app/services/synthetic_data.py`'s fraud/normal generators, for faster demo/testing.
5. Route this page at `/predict` from PROMPT 5.

Acceptance criteria:
- Submitting a form makes exactly one `POST /api/predict` call.
- Displayed result matches the API response.
- Per PROMPT 3, this manual prediction now also appears in `/transactions` with `source="manual"` — verify this end-to-end.

---

## PROMPT 7 — CSV/batch prediction (backend + frontend)

Inspect `backend/app/api/predict.py` and `backend/app/models/transaction.py` before adding new code — reuse `get_model_service()` and the `Transaction` model, don't duplicate prediction logic.

Backend tasks:
1. Create `backend/app/api/batch.py` with `POST /api/predict/batch` accepting a CSV file upload (use FastAPI's `UploadFile`).
2. Validate: required columns are `Amount` and `V1`-`V28` (case-insensitive match); reject with a clear 400 error listing missing columns if any are absent; reject empty files; cap row count (e.g. 5,000 rows) and reject larger files with a clear error rather than hanging.
3. For each valid row, call `get_model_service().predict()`, then create and commit a `Transaction` row with `source="csv"`, `is_simulated=False`.
4. Return a summary: `{total_rows, processed, fraud_flagged, normal, errors: [...]}`.
5. Register the new router in `backend/app/main.py` the same way `predict`, `transactions`, and `metrics` routers are registered — do not change how the existing three are wired.

Frontend tasks:
6. Add `predictBatch(file)` to `frontend/src/api.js` using `FormData`, following the existing style of the other functions in that file.
7. Add a CSV upload section to `frontend/src/pages/Predict.jsx` (or a new `frontend/src/pages/BatchPredict.jsx` if that keeps the page cleaner — your call, but keep it under the same `/predict` route as a tab, not a separate nav item, since the spec groups all three prediction modes together) with a file input and a results summary table.

Acceptance criteria:
- Uploading a valid CSV creates one `Transaction` row per row with `source="csv"`.
- Invalid CSV (missing columns, empty file, wrong types) returns a clear error, no partial DB writes on validation failure.
- Existing `/api/predict` (manual) and `/transactions/simulate` endpoints are unaffected.

---

## PROMPT 8 — All Transactions page (search, filter, pagination)

Inspect `backend/app/api/transactions.py`'s `GET /transactions` endpoint first — it already supports `page`, `page_size`, `risk_level`, `from_date`, `to_date` query params. Check whether it supports filtering by `is_fraud` or `reviewed` — if not, extend it minimally rather than building a second endpoint.

Backend tasks (only if gaps found):
1. Add optional `is_fraud: Optional[bool]` and `reviewed: Optional[bool]` query params to `get_transactions` in `transactions.py`, following the same `if param: query = query.filter(...)` pattern already used for `risk_level`.

Frontend tasks:
2. Create `frontend/src/pages/AllTransactions.jsx` with a table: ID, Time, Amount, Fraud Probability, Prediction, Risk, Source, Review Status, Actions.
3. Add filter controls (All / Fraud / Normal / Low / Medium / High / Reviewed / Unreviewed) that map to the query params above, and pagination controls using the existing `total`/`page`/`page_size` response fields.
4. Clicking a row navigates to `/transactions/:id` (built in PROMPT 10).
5. Route at `/transactions`.

Acceptance criteria:
- Filters correctly narrow results via real API calls, not client-side filtering of a single page of data.
- Pagination works with more than one page of results (test by simulating 50+ transactions).
- No change to the simulate/predict/review endpoints.

---

## PROMPT 9 — Fraud / Normal / High-Risk filtered views

Inspect `frontend/src/pages/AllTransactions.jsx` from PROMPT 8 before building these — they should reuse the same table component with a preset filter, not duplicate the table markup.

Tasks:
1. Extract the transaction table from `AllTransactions.jsx` into a reusable `frontend/src/components/TransactionTable.jsx` that accepts a `filters` prop.
2. Create `frontend/src/pages/FraudTransactions.jsx` (preset `is_fraud=true`), reusing `TransactionTable`.
3. Create a Normal view (preset `is_fraud=false`) — decide whether this needs its own route or a filter toggle on `AllTransactions`, and note your choice in the report.
4. Create `frontend/src/pages/HighRiskAlerts.jsx` (preset `risk_level=high`), reusing `TransactionTable`, and preserve the existing "Mark Reviewed" action (already implemented correctly in `AlertsPanel.jsx` — reuse that `handleReview` pattern, don't reimplement it).
5. Route at `/transactions/fraud` and `/transactions/high-risk`.

Acceptance criteria:
- All three views hit the real filtered API, not a client-side filter of already-fetched data.
- Mark Reviewed works identically to the existing dashboard alerts panel.
- No duplicated table-rendering code between `AllTransactions` and these three views.

---

## PROMPT 10 — Transaction Details page

Inspect `backend/app/api/transactions.py` — there is currently no single-transaction GET endpoint (`GET /transactions` only returns a paginated list). Confirm this before adding one.

Backend tasks:
1. Add `GET /api/transactions/{tx_id}` to `transactions.py` returning the full row including `v1`-`v28`, reusing the `Transaction` model — do not create a new schema class if `TransactionOut` can be extended, but check whether the dashboard's list view needs to stay lean (if so, create a separate `TransactionDetail` response model that includes `v1`-`v28` and reuse `TransactionOut`'s fields, rather than adding v1-v28 to the list response and bloating every list call).

Frontend tasks:
2. Create `frontend/src/pages/TransactionDetail.jsx`, route at `/transactions/:id`.
3. Display: ID, Timestamp, Amount, V1-V28 (collapsible/table), Fraud Probability, Prediction, Risk Level, Source, Review Status.
4. Add a "Mark Reviewed" button using the existing `api.reviewTransaction(id)` call.

Acceptance criteria:
- Navigating from any transaction table row to its detail page shows correct, matching data.
- Mark Reviewed on this page updates the same DB row the list views read from (verify by returning to the list and confirming the reviewed status persisted).

---

## PROMPT 11 — Dashboard UI redesign

Inspect `frontend/src/pages/Dashboard.jsx` (moved in PROMPT 5), `frontend/src/components/SummaryCards.jsx`, `frontend/src/components/TransactionFeed.jsx`, and `frontend/src/index.css` before changing anything. Preserve the existing polling logic, toast system, and component boundaries — this is a visual/layout pass, not a rewrite.

Tasks:
1. Add action buttons to the dashboard: Predict Transaction, Simulate Transactions (existing), View All Transactions, View Fraud, View High Risk, View Analytics — using `<Link>` from `react-router-dom` to the routes built in earlier prompts.
2. Review `SummaryCards.jsx` — confirm it already shows Total Transactions, Fraud Detected, Normal Transactions, Fraud Rate, High Risk (check against `metrics.live_stats` shape from `backend/app/api/metrics.py`); add any missing card rather than rebuilding the component.
3. Clean up visual hierarchy/spacing per existing CSS variables in `index.css` — don't introduce a new design system or new color palette, extend what's there.
4. Do not remove or break the existing 5-second polling, the toast notifications, or the simulate button.

Acceptance criteria:
- All dashboard data sources and refresh behavior unchanged.
- New navigation buttons correctly link to their routes.
- No new CSS framework/library added.

---

## PROMPT 12 — End-to-end testing and bug fixing

Tasks:
1. Start backend and frontend together. Walk through: Simulate transactions → Manual predict → CSV batch predict → verify all three appear correctly in All Transactions with correct `source` values → filter to Fraud/Normal/High Risk → open a transaction detail → Mark Reviewed → confirm it reflects across dashboard, alerts panel, and the detail page → check hourly chart renders with real data → check `/api/metrics` reflects real trained-model numbers.
2. Confirm `/docs` (Swagger) still lists and correctly documents every endpoint, old and new.
3. Report every file changed across all 11 prompts, grouped by prompt number.
4. Confirm the app still runs from a clean `git clone` + `npm install` + `pip install -r requirements.txt` (aside from needing `creditcard.csv` placed locally and training run once).

Acceptance criteria: the FINAL IMPLEMENTATION CHECKLIST below is fully checked off, with no regressions to anything that worked before PROMPT 1.

---

## FINAL IMPLEMENTATION CHECKLIST

- [ ] Real Kaggle dataset used for training (not synthetic)
- [ ] Both models retrained, metrics reflect real data (no "DEMO" labels)
- [ ] XGBoost model artifact saved and loaded correctly at startup
- [ ] Manual prediction works and hits the real model
- [ ] Manual predictions stored in DB with source="manual"
- [ ] Simulation still works unchanged
- [ ] CSV batch prediction works, validates input, stores with source="csv"
- [ ] Hourly chart bug fixed (`Integer` cast, not `int`)
- [ ] Hourly chart renders correctly with real + empty data
- [ ] All Transactions page: search, filter, pagination all hit real API
- [ ] Fraud / Normal / High-Risk filtered views work
- [ ] Transaction Details page shows full V1-V28 + prediction info
- [ ] Mark Reviewed works consistently across dashboard, alerts, list, and detail views
- [ ] Dashboard redesigned with nav buttons, existing polling/toasts intact
- [ ] Swagger/OpenAPI docs list all endpoints correctly
- [ ] All pre-existing endpoints (`/predict`, `/transactions/simulate`, `/transactions`, `/transactions/{id}/review`, `/transactions/stats/hourly`, `/metrics`) still work
- [ ] End-to-end walkthrough completed with no regressions
