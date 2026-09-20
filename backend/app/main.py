"""
main.py — FastAPI Application Entry Point
AI-Powered Fraud Detection Platform — Backend API
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.models.database import create_tables
from app.api import predict, transactions, metrics

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
).split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables and warm up model on startup."""
    print("[Startup] Creating database tables...")
    create_tables()
    print("[Startup] Warming up model service...")
    from app.services.model_service import get_model_service
    get_model_service()
    print("[Startup] Ready!")
    yield
    print("[Shutdown] Goodbye!")


app = FastAPI(
    title="AI-Powered Fraud Detection Platform",
    description=(
        "REST API for real-time credit card fraud detection. "
        "Serves an XGBoost model trained on the Kaggle creditcard dataset. "
        "SDG 16 — Peace, Justice and Strong Institutions."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow React frontend on localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(predict.router, prefix="/api", tags=["Prediction"])
app.include_router(transactions.router, prefix="/api", tags=["Transactions"])
app.include_router(metrics.router, prefix="/api", tags=["Metrics"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "AI-Powered Fraud Detection Platform",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", 8000)),
        reload=True,
    )
