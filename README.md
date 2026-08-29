# PRJ_388 — AI-Powered Fraud Detection Platform

## Project Overview

**PRJ_388 — AI-Powered Fraud Detection Platform** is a machine-learning-based system designed to detect potentially fraudulent financial transactions.

The project combines data preprocessing, exploratory data analysis (EDA), class-imbalance handling, machine learning models, a REST API backend, a SQLite database, and a React-based dashboard. The goal is to provide a practical fraud-detection platform that can generate predictions and expose useful transaction and model metrics through a web interface.

## Objectives

- Detect fraudulent transactions using machine learning.
- Analyze and preprocess transaction data before model training.
- Handle class imbalance using **SMOTE (Synthetic Minority Oversampling Technique)**.
- Establish **Logistic Regression** as a baseline model.
- Train and evaluate an **XGBoost** fraud-detection model.
- Perform feature engineering and select useful features.
- Provide prediction and transaction-related API endpoints.
- Store application/transaction data using **SQLite**.
- Build a React dashboard for visualizing transactions, model metrics, and fraud alerts.
- Integrate, test, document, and demonstrate the complete system.

## Technology Stack

| Category | Technology |
|---|---|
| Programming Language | Python 3.11 |
| Backend / API | FastAPI + Uvicorn |
| Frontend | React (Vite) |
| Machine Learning | Scikit-learn, XGBoost |
| Data Processing | Pandas, NumPy |
| Class Imbalance | Imbalanced-learn (SMOTE) |
| Database | SQLite |
| Version Control | Git / GitHub |
| API Testing | Postman (optional) |
| Development Environment | VS Code / Jupyter Notebook / Google Colab |

## System Workflow

```text
Transaction Dataset
        ↓
Data Preprocessing
        ↓
Exploratory Data Analysis (EDA)
        ↓
Class Imbalance Analysis
        ↓
SMOTE / Imbalance Handling
        ↓
Feature Engineering
        ↓
Model Training
   ┌────┴─────────────┐
   ↓                  ↓
Logistic Regression   XGBoost
   │                  │
   └───────┬──────────┘
           ↓
     Model Evaluation
           ↓
      Selected Model
           ↓
      FastAPI Backend
           ↓
     SQLite Database
           ↓
      React Dashboard
           ↓
 Fraud Predictions / Metrics / Alerts
```

## Machine Learning Approach

### 1. Data Preprocessing

The transaction dataset is cleaned and prepared for machine learning. Typical preprocessing includes:

- Handling missing or invalid values.
- Checking data types.
- Removing unnecessary fields where applicable.
- Preparing input features and the fraud target variable.
- Scaling or transforming features where required by the selected model.

### 2. Exploratory Data Analysis

EDA is performed to understand:

- Dataset structure and feature distributions.
- Transaction patterns.
- Fraud vs. legitimate transaction distribution.
- Potential relationships between features and fraud.
- Outliers and unusual transaction behavior.

### 3. Class Imbalance Handling

Fraud datasets are generally highly imbalanced because legitimate transactions greatly outnumber fraudulent ones.

The project uses **SMOTE** to generate synthetic examples of the minority fraud class in the training data. This helps the model learn fraud patterns without simply favoring the majority class.

> SMOTE should be applied only to the training data to avoid data leakage.

### 4. Models

#### Logistic Regression

Logistic Regression is used as a baseline model because it is:

- Simple and interpretable.
- Fast to train.
- Useful for establishing a baseline performance.

#### XGBoost

XGBoost is used as the main tree-based machine learning approach because it can model complex, non-linear relationships between transaction features.

The models are evaluated using fraud-appropriate metrics rather than relying only on accuracy.

### 5. Evaluation Metrics

Important metrics for the project include:

- **Precision** — proportion of transactions predicted as fraud that are actually fraudulent.
- **Recall** — proportion of actual fraudulent transactions detected by the model.
- **F1-score** — balance between precision and recall.
- **ROC-AUC** — measures ranking/classification performance across thresholds.
- **Confusion Matrix** — shows true positives, true negatives, false positives, and false negatives.

For fraud detection, **recall is especially important** because missing a fraudulent transaction can have a significant impact.

## Backend

The backend is implemented using **FastAPI** and served using **Uvicorn**.

The API is responsible for:

- Receiving transaction data.
- Generating fraud predictions.
- Managing transaction-related information.
- Providing model performance metrics.
- Connecting the application to SQLite.
- Serving data required by the frontend dashboard.

Example endpoint categories:

```text
/predict
/transactions
/metrics
```

The exact endpoint paths may vary depending on the final implementation.

## Database

**SQLite** is used as the project database because it is lightweight and suitable for a mini-project deployment.

It can be used to store information such as:

- Transaction records.
- Prediction results.
- Fraud/legitimate classification.
- Relevant timestamps.
- Dashboard-related data.

## Frontend

The frontend is developed using **React with Vite**.

The dashboard is intended to provide:

- Transaction information.
- Fraud prediction results.
- Charts and model metrics.
- Fraud alerts.
- A clear interface for monitoring transaction activity.

## Project Timeline

| Task | Week |
|---|---|
| Project setup, repository & dataset collection | Week 1 |
| Data preprocessing & EDA | Week 1 |
| Class imbalance analysis | Week 1 |
| Logistic Regression baseline model | Week 2 |
| XGBoost model & evaluation | Week 2 |
| Feature engineering & model selection | Week 2 |
| FastAPI backend & SQLite integration | Week 3 |
| Prediction / transaction / metrics endpoints | Week 3 |
| React dashboard, charts & alerts panel | Week 4 |
| Integration, testing, documentation & demo preparation | Week 4 |

## Hardware Requirements

- **Processor:** Dual-core 2.0 GHz minimum; Quad-core 2.5 GHz+ recommended
- **RAM:** 4 GB minimum; 8 GB+ recommended
- **Storage:** Approximately 10 GB free SSD space recommended
- **Internet:** Required for dataset/package downloads and installation
- **GPU:** Not required; Logistic Regression and XGBoost can be trained on CPU for the project dataset

## Software Requirements

- Windows 10/11, macOS, or Linux
- Python 3.11
- Node.js and npm for the React frontend
- Git
- VS Code or another suitable IDE
- Jupyter Notebook / Google Colab for experimentation (optional)
- Postman for API testing (optional)

## Installation

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <PROJECT_DIRECTORY>
```

### 2. Create a Python virtual environment

```bash
python3.11 -m venv .venv
```

Activate it:

**macOS / Linux**
```bash
source .venv/bin/activate
```

**Windows**
```powershell
.venv\Scriptsctivate
```

### 3. Install Python dependencies

If a `requirements.txt` file is available:

```bash
pip install -r requirements.txt
```

Otherwise, install the core packages:

```bash
pip install fastapi uvicorn pandas numpy scikit-learn xgboost imbalanced-learn
```

### 4. Start the FastAPI backend

Depending on the project structure, for example:

```bash
uvicorn main:app --reload
```

The API will normally be available at:

```text
http://127.0.0.1:8000
```

FastAPI's interactive documentation is normally available at:

```text
http://127.0.0.1:8000/docs
```

### 5. Start the React frontend

Move to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed by Vite in the terminal.

## Recommended Project Structure

```text
PRJ_388/
│
├── backend/
│   ├── main.py
│   ├── models/
│   ├── routes/
│   ├── database/
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── data/
│   └── dataset.csv
│
├── notebooks/
│   └── EDA_and_model_training.ipynb
│
├── models/
│   └── trained_model
│
├── requirements.txt
├── README.md
└── .gitignore
```

The actual folder structure should be updated to match the final implementation.

## API Testing

API endpoints can be tested using:

- FastAPI Swagger UI at `/docs`
- Postman
- cURL

Example prediction request:

```json
{
  "feature_1": 0.25,
  "feature_2": 1.73
}
```

The actual request fields must match the features expected by the trained model.

## Security and Data Considerations

- Do not commit passwords, API keys, tokens, or other secrets to GitHub.
- Keep sensitive transaction information protected.
- Validate API inputs before making predictions.
- Do not expose database files or private datasets unnecessarily.
- Use environment variables for configuration and secrets where required.

## Current Project Status

The project is being developed in stages:

1. Project setup and dataset collection
2. Data preprocessing and EDA
3. Class imbalance analysis
4. Baseline and XGBoost model development
5. Feature engineering and model selection
6. FastAPI and SQLite integration
7. API endpoint development
8. React dashboard development
9. Integration, testing, documentation, and demo preparation

## Future Scope

Possible future improvements include:

- Real-time transaction-stream processing.
- Advanced anomaly-detection techniques.
- Model explainability using SHAP or similar methods.
- Automated model retraining.
- Cloud deployment.
- Authentication and role-based access.
- More advanced alerting and monitoring.
- Model drift detection.
- Integration with real payment/transaction systems.

## Team / Academic Information

**Project:** PRJ_388 — AI-Powered Fraud Detection Platform  
**Course:** CSE7102 Mini Project  
**Institution:** Presidency University  
**Project Type:** Machine Learning + Full-Stack Application

## Disclaimer

This project is intended for academic and demonstration purposes. Predictions produced by the machine-learning model should not be treated as definitive proof of fraudulent activity without appropriate human or business verification.
