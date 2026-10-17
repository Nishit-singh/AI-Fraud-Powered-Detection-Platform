/**
 * Dashboard.jsx — Redesigned dashboard (Prompt 11)
 *
 * Layout (top → bottom):
 *  1. Hero banner — platform title + live status + simulate CTA
 *  2. KPI stat bar — 6 animated metric cards
 *  3. Live feed (full width) — clickable rows → /transactions/:id
 *  4. Two-column section: Fraud Rate chart + Alerts panel
 *  5. Bottom row: Model Performance chart + Quick-action cards
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { FraudRateChart, ModelPerformanceChart } from '../components/Charts';

const POLL_INTERVAL = 5000;

/* ── Toast ─────────────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, accent, trend }) {
  return (
    <div className={`kpi-card kpi-${accent}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend >= 0 ? '↑' : '↓'}
        </div>
      )}
    </div>
  );
}

/* ── Live Feed Row ──────────────────────────────────────────────────────────── */
function FeedRow({ tx, navigate }) {
  const pct = Math.round(tx.fraud_probability * 100);
  const probColor = pct >= 60 ? 'var(--accent-red)' : pct >= 30 ? 'var(--accent-yellow)' : 'var(--accent-green)';

  const formatTime = (ts) => {
    try { return new Date(ts + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch { return '—'; }
  };

  return (
    <tr
      className={`feed-row-clickable${tx.is_fraud ? ' feed-row-fraud' : ''}`}
      onClick={() => navigate(`/transactions/${tx.id}`)}
      title="Click to view details"
    >
      <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{tx.id}</td>
      <td className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(tx.transaction_time)}</td>
      <td className="mono" style={{ fontWeight: 700 }}>${typeof tx.amount === 'number' ? tx.amount.toFixed(2) : '—'}</td>
      <td>
        <span className={`risk-badge ${tx.risk_level}`}>
          {tx.risk_level === 'high' ? '🔴' : tx.risk_level === 'medium' ? '🟡' : '🟢'}
          {' '}{tx.risk_level}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: probColor, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: probColor, minWidth: 30 }}>{pct}%</span>
        </div>
      </td>
      <td>
        {tx.is_fraud
          ? <span style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: 12 }}>🚨 FRAUD</span>
          : <span style={{ color: 'var(--accent-green)', fontSize: 12 }}>✅ Normal</span>}
      </td>
    </tr>
  );
}

/* ── Live Feed Panel ────────────────────────────────────────────────────────── */
function LiveFeed({ transactions, onSimulate, loading, navigate }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? transactions
    : filter === 'fraud'
      ? transactions.filter(t => t.is_fraud)
      : transactions.filter(t => t.risk_level === filter);

  return (
    <div className="feed-card">
      <div className="feed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="section-title">Live Transaction Feed</span>
          <span className="live-badge"><span className="live-dot" />Live</span>
        </div>
        <div className="feed-controls">
          <div className="filter-chips">
            {[
              ['all', 'All'],
              ['fraud', '🚨 Fraud'],
              ['high', '🔴 High'],
              ['medium', '🟡 Med'],
              ['low', '🟢 Low'],
            ].map(([val, lbl]) => (
              <button
                key={val}
                id={`filter-${val}`}
                className={`chip ${filter === val ? 'active' : ''}`}
                onClick={() => setFilter(val)}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button id="simulate-btn" className="btn btn-primary" onClick={onSimulate} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Simulating…</> : '⚡ Simulate (20)'}
          </button>
        </div>
      </div>

      <div className="feed-table-wrapper">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No transactions yet. Click <strong>Simulate</strong> to generate data.</div>
          </div>
        ) : (
          <table className="feed-table">
            <thead>
              <tr>
                <th>#</th><th>Time</th><th>Amount</th><th>Risk</th><th>Fraud Prob.</th><th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => <FeedRow key={tx.id} tx={tx} navigate={navigate} />)}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {transactions.length} · Click any row for details
        </span>
        <Link to="/transactions" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
          View All →
        </Link>
      </div>
    </div>
  );
}

/* ── Alerts Panel ─────────────────────────────────────────────────────────── */
function AlertsPanel({ alerts, onReview }) {
  const unreviewed = alerts.filter(a => !a.reviewed);
  const navigate   = useNavigate();

  const formatTime = (ts) => {
    try { return new Date(ts + 'Z').toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  const handleReview = async (e, id) => {
    e.stopPropagation();
    try { await api.reviewTransaction(id); onReview(id); } catch { /* silent */ }
  };

  return (
    <div className="alerts-panel">
      <div className="alerts-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="section-title">🚨 High-Risk Alerts</span>
          {unreviewed.length > 0 && <span className="alert-count-badge">{unreviewed.length}</span>}
        </div>
        <Link to="/transactions/high-risk" style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <div className="empty-state-icon">🛡️</div>
          <div className="empty-state-text">No high-risk alerts</div>
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          {alerts.map(alert => (
            <div
              key={alert.id}
              id={`alert-${alert.id}`}
              className={`alert-item${alert.reviewed ? ' reviewed' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/transactions/${alert.id}`)}
            >
              <div className="alert-item-header">
                <span className="alert-item-amount">
                  ${typeof alert.amount === 'number' ? alert.amount.toFixed(2) : '—'}
                </span>
                <span className="alert-item-prob" style={{ color: 'var(--accent-red)' }}>
                  {(alert.fraud_probability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="alert-item-time">{formatTime(alert.transaction_time)}</div>
              {!alert.reviewed ? (
                <button
                  id={`review-btn-${alert.id}`}
                  className="btn btn-ghost btn-sm w-full"
                  onClick={(e) => handleReview(e, alert.id)}
                >
                  ✓ Mark Reviewed
                </button>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--accent-green)', textAlign: 'center', marginTop: 4 }}>✅ Reviewed</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Quick Action Cards ─────────────────────────────────────────────────────── */
function QuickActions() {
  const actions = [
    { to: '/predict',               icon: '⚡', title: 'Predict Transaction', desc: 'Run a single transaction through the model with SHAP explanation', accent: 'blue' },
    { to: '/predict',               icon: '📂', title: 'CSV Batch Upload',    desc: 'Upload a CSV of up to 5,000 rows for bulk prediction', accent: 'purple' },
    { to: '/transactions/fraud',    icon: '🚨', title: 'Fraud Transactions',  desc: 'Browse all flagged fraud cases and export for review', accent: 'red' },
    { to: '/transactions/high-risk',icon: '⚠️', title: 'High-Risk Queue',    desc: 'Triage unreviewed high-risk alerts before they escalate', accent: 'yellow' },
    { to: '/analytics',             icon: '📊', title: 'Analytics',          desc: 'Deep-dive charts: ROC curve, confusion matrix, feature importance', accent: 'green' },
    { to: '/transactions',          icon: '📋', title: 'All Transactions',   desc: 'Full searchable, filterable table of every recorded transaction', accent: 'blue' },
  ];
  return (
    <div className="dash-quick-grid">
      {actions.map(a => (
        <Link key={a.to + a.title} to={a.to} className={`quick-action-card qa-${a.accent}`}>
          <div className="qa-icon">{a.icon}</div>
          <div className="qa-title">{a.title}</div>
          <div className="qa-desc">{a.desc}</div>
        </Link>
      ))}
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [metrics, setMetrics]           = useState(null);
  const [hourlyData, setHourlyData]     = useState([]);
  const [simulating, setSimulating]     = useState(false);
  const [toasts, setToasts]             = useState([]);
  const pollRef = useRef(null);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.getTransactions({ page_size: 50 });
      if (data.items) {
        setTransactions(data.items);
        setAlerts(data.items.filter(t => t.risk_level === 'high'));
      }
    } catch { /* silent */ }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try { setMetrics(await api.getMetrics()); } catch { /* silent */ }
  }, []);

  const fetchHourly = useCallback(async () => {
    try {
      const data = await api.getHourlyStats();
      if (data.data) setHourlyData(data.data);
    } catch { /* silent */ }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchTransactions(), fetchMetrics(), fetchHourly()]);
  }, [fetchTransactions, fetchMetrics, fetchHourly]);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await api.simulate(20, 0.15);
      addToast(`✓ Simulated 20 transactions — ${res.fraud_flagged} fraud flagged`, 'success');
      await fetchAll();
    } catch {
      addToast('✗ Simulation failed — is the backend running?', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleReview = useCallback((id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, reviewed: true } : a));
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, reviewed: true } : t));
    addToast('✓ Alert marked as reviewed', 'success');
  }, [addToast]);

  /* KPI data */
  const stats = metrics?.live_stats || {};
  const xgb   = metrics?.model_metrics?.xgboost || {};
  const kpis = [
    { icon: '🔄', label: 'Total Transactions', value: (stats.total_transactions ?? 0).toLocaleString(), sub: 'All time', accent: 'blue' },
    { icon: '🚨', label: 'Fraud Detected',     value: (stats.fraud_detected ?? 0).toLocaleString(),    sub: `${stats.unreviewed_alerts ?? 0} unreviewed`, accent: 'red' },
    { icon: '📊', label: 'Fraud Rate',          value: stats.fraud_rate != null ? `${(stats.fraud_rate * 100).toFixed(2)}%` : '—', sub: 'Of all transactions', accent: 'yellow' },
    { icon: '⚠️', label: 'High Risk',           value: (stats.high_risk_count ?? 0).toLocaleString(),  sub: 'Flagged high-risk', accent: 'orange' },
    { icon: '🎯', label: 'Model Recall',        value: xgb.recall != null ? `${(xgb.recall * 100).toFixed(1)}%` : '—', sub: 'XGBoost fraud recall', accent: 'green' },
    { icon: '✅', label: 'Precision',           value: xgb.precision != null ? `${(xgb.precision * 100).toFixed(1)}%` : '—', sub: 'Alert accuracy', accent: 'purple' },
  ];

  return (
    <main className="main-content">

      {/* ── Hero Banner ────────────────────────────────────────────── */}
      <div className="dash-hero">
        <div className="dash-hero-text">
          <h1 className="dash-hero-title">AI Fraud Detection Platform</h1>
          <p className="dash-hero-sub">
            Real-time credit card fraud detection powered by XGBoost · ROC-AUC&nbsp;
            <strong style={{ color: 'var(--accent-blue)' }}>{xgb.roc_auc ? (xgb.roc_auc * 100).toFixed(2) + '%' : '98.09%'}</strong>
          </p>
        </div>
        <div className="dash-hero-actions">
          <button className="btn btn-primary" onClick={handleSimulate} disabled={simulating} id="hero-simulate-btn">
            {simulating ? <><span className="btn-spinner" /> Simulating…</> : '⚡ Simulate Transactions'}
          </button>
          <Link to="/predict" className="btn btn-ghost">🎯 Manual Prediction</Link>
        </div>
      </div>

      {/* ── KPI Bar ─────────────────────────────────────────────────── */}
      <div className="kpi-bar">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ── Live Feed ────────────────────────────────────────────────── */}
      <LiveFeed
        transactions={transactions}
        onSimulate={handleSimulate}
        loading={simulating}
        navigate={navigate}
      />

      {/* ── Charts + Alerts row ─────────────────────────────────────── */}
      <div className="dashboard-grid">
        <div className="charts-col">
          <FraudRateChart data={hourlyData} />
          <ModelPerformanceChart metrics={metrics} />
        </div>
        <div className="alerts-col">
          <AlertsPanel alerts={alerts} onReview={handleReview} />
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 28 }}>
        <div className="section-title" style={{ marginBottom: 16, display: 'block' }}>🚀 Quick Actions</div>
        <QuickActions />
      </div>

      <Toast toasts={toasts} />
    </main>
  );
}
