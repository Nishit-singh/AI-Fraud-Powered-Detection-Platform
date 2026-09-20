"""
SQLAlchemy ORM model for transactions and predictions.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_time = Column(DateTime, default=datetime.utcnow, index=True)
    amount = Column(Float, nullable=False)

    # PCA features (V1-V28)
    v1 = Column(Float)
    v2 = Column(Float)
    v3 = Column(Float)
    v4 = Column(Float)
    v5 = Column(Float)
    v6 = Column(Float)
    v7 = Column(Float)
    v8 = Column(Float)
    v9 = Column(Float)
    v10 = Column(Float)
    v11 = Column(Float)
    v12 = Column(Float)
    v13 = Column(Float)
    v14 = Column(Float)
    v15 = Column(Float)
    v16 = Column(Float)
    v17 = Column(Float)
    v18 = Column(Float)
    v19 = Column(Float)
    v20 = Column(Float)
    v21 = Column(Float)
    v22 = Column(Float)
    v23 = Column(Float)
    v24 = Column(Float)
    v25 = Column(Float)
    v26 = Column(Float)
    v27 = Column(Float)
    v28 = Column(Float)

    # Engineered features
    transaction_hour = Column(Integer)
    amount_zscore = Column(Float)

    # Prediction results
    is_fraud = Column(Boolean, default=False)
    fraud_probability = Column(Float, default=0.0)
    risk_level = Column(String(10), default="low")  # low | medium | high

    # Status
    reviewed = Column(Boolean, default=False)
    is_simulated = Column(Boolean, default=True)
    source = Column(String(20), default="simulate")  # simulate | api
