/**
 * TransactionDetail.jsx — Transaction Detail page (Prompt 10)
 * Route: /transactions/:id
 *
 * Displays:
 *  - Back button → history.back() or /transactions
 *  - Verdict card (FRAUD / NORMAL, probability bar, risk badge)
 *  - Metadata section (ID, time, source, hour, amount_zscore, reviewed)
 *  - V1-V28 feature grid (read-only, highlighted if absolute value > 1.5)
 *  - Mark Reviewed action
 *  - 404 state, loading skeleton, error state
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const SOURCE_LABELS = { simulate: '🤖 Simulated', manual: '🖊 Manual', csv: '📂 CSV' };

function fmt(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr + 'Z').toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'medium' });
}

function ProbBar({ prob }) {
  const pct = Math.round(prob * 100);
  const color = pct >= 60 ? 'var(--accent-red)' : pct >= 30 ? 'var(--accent-yellow)' : 'var(--accent-green)';
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        <span>Fraud Probability</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: color, transition: 'width 0.8s ease', boxShadow: `0 0 10px ${color}66` }} />
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="detail-meta-row">
      <span className="detail-meta-label">{label}</span>
      <span className="detail-meta-value">{value}</span>
    </div>
  );
}

/* ── Feature grid ─────────────────────────────────────────────────────────── */

function FeatureGrid({ features }) {
  if (!features) return null;
  return (
    <div className="card detail-feature-card">
      <div className="chart-title" style={{ marginBottom: 14 }}>
        🔢 PCA Feature Values (V1–V28)
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 10 }}>
          Highlighted cells have |value| &gt; 1.5 — stronger signal
        </span>
      </div>
      <div className="detail-feature-grid">
        {Object.entries(features).map(([key, val]) => {
          const abs = Math.abs(val ?? 0);
          const strong = abs >= 1.5;
          const color = strong ? (val > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)') : 'transparent';
          const textColor = strong ? (val > 0 ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-primary)';
          return (
            <div key={key} className="detail-feature-cell" style={{ background: color }}>
              <div className="detail-feature-name">{key}</div>
              <div className="detail-feature-val" style={{ color: textColor }}>
                {val !== null && val !== undefined ? val.toFixed(4) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function TransactionDetail() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const [tx, setTx]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getTransaction(id)
      .then(res => {
        if (res.detail) throw new Error(res.detail);
        setTx(res);
      })
      .catch(err => setError(err.message || 'Failed to load transaction.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReview = async () => {
    if (reviewing || tx?.reviewed) return;
    setReviewing(true);
    try {
      await api.reviewTransaction(id);
      setTx(prev => ({ ...prev, reviewed: true }));
    } catch {
      // silently ignore
    } finally {
      setReviewing(false);
    }
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <main className="main-content">
        <div className="page-header">
          <div className="skeleton-cell" style={{ width: 140, height: 16, marginBottom: 10 }} />
          <div className="skeleton-cell" style={{ width: 260, height: 26 }} />
        </div>
        <div style={{ display: 'grid', gap: 20 }}>
          {[200, 140, 300].map((h, i) => <div key={i} className="card skeleton-cell" style={{ height: h }} />)}
        </div>
      </main>
    );
  }

  /* ── Error / 404 ── */
  if (error) {
    return (
      <main className="main-content">
        <div className="card" style={{ textAlign: 'center', padding: '60px 32px' }}>
          <div className="empty-state-icon" style={{ fontSize: 48 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14 }}>
            Transaction Not Found
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, marginBottom: 24 }}>{error}</div>
          <button className="btn btn-primary" onClick={() => navigate('/transactions')}>
            ← Back to All Transactions
          </button>
        </div>
      </main>
    );
  }

  const riskColor = tx.risk_level === 'high' ? 'var(--accent-red)' : tx.risk_level === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-green)';

  return (
    <main className="main-content">
      {/* Back navigation */}
      <button className="detail-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* Page title */}
      <div className="page-header" style={{ marginTop: 12 }}>
        <h1 className="page-title">
          {tx.is_fraud ? '🚨' : '✅'} Transaction #{tx.id}
        </h1>
        <p className="page-subtitle">
          {SOURCE_LABELS[tx.source] ?? tx.source} · {fmt(tx.transaction_time)}
        </p>
      </div>

      <div className="detail-layout">

        {/* ── LEFT column ── */}
        <div className="detail-left">

          {/* Verdict card */}
          <div className={`card detail-verdict-card ${tx.is_fraud ? 'result-fraud' : 'result-normal'}`}>
            <div className="predict-verdict">
              <div className="predict-verdict-icon" style={{ fontSize: 40 }}>{tx.is_fraud ? '🚨' : '✅'}</div>
              <div>
                <div className={`predict-verdict-label ${tx.is_fraud ? 'fraud' : 'normal'}`}>
                  {tx.is_fraud ? 'FRAUD DETECTED' : 'NORMAL'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                  Confidence: <strong style={{ color: riskColor }}>{(tx.fraud_probability * 100).toFixed(2)}%</strong>
                </div>
              </div>
            </div>
            <ProbBar prob={tx.fraud_probability} />

            <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Risk Level</div>
                <span className={`risk-badge ${tx.risk_level}`}>
                  {tx.risk_level === 'high' ? '🔴' : tx.risk_level === 'medium' ? '🟡' : '🟢'}
                  {' '}{tx.risk_level.toUpperCase()}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Amount</div>
                <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                  ${tx.amount.toFixed(2)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Review</div>
                {tx.reviewed
                  ? <span style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: 13 }}>✅ Reviewed</span>
                  : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleReview}
                      disabled={reviewing}
                      style={{ fontSize: 12 }}
                    >
                      {reviewing ? '…' : '✓ Mark Reviewed'}
                    </button>
                  )}
              </div>
            </div>
          </div>

          {/* Metadata card */}
          <div className="card" style={{ padding: 22 }}>
            <div className="chart-title" style={{ marginBottom: 14 }}>📋 Transaction Metadata</div>
            <div className="detail-meta-list">
              <MetaRow label="Transaction ID"  value={`#${tx.id}`} />
              <MetaRow label="Time"            value={fmt(tx.transaction_time)} />
              <MetaRow label="Source"          value={SOURCE_LABELS[tx.source] ?? tx.source} />
              <MetaRow label="Simulated"       value={tx.is_simulated ? 'Yes' : 'No'} />
              <MetaRow label="Hour of Day"     value={tx.transaction_hour !== null ? `${String(tx.transaction_hour).padStart(2, '0')}:00` : '—'} />
              <MetaRow label="Amount Z-Score"  value={tx.amount_zscore !== null ? tx.amount_zscore.toFixed(4) : '—'} />
              <MetaRow label="Review Status"   value={tx.reviewed ? '✅ Reviewed' : '⏳ Pending'} />
            </div>
          </div>
        </div>

        {/* ── RIGHT: Feature grid ── */}
        <div className="detail-right">
          <FeatureGrid features={tx.features} />

          {/* Navigate to similar */}
          <div className="card" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>
              📋 All Transactions
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions/fraud')}>
              🚨 Fraud Transactions
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions/high-risk')}>
              ⚠️ High Risk Alerts
            </button>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => navigate('/predict')}>
              ⚡ New Prediction
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
