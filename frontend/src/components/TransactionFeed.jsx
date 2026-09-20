import { useState } from 'react';

function RiskBadge({ level }) {
  const icons = { low: '🟢', medium: '🟡', high: '🔴' };
  return (
    <span className={`risk-badge ${level}`}>
      {icons[level] || '⚪'} {level}
    </span>
  );
}

function ProbBar({ prob, level }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="prob-bar-wrap" style={{ flex: 1 }}>
        <div
          className={`prob-bar ${level}`}
          style={{ width: `${(prob * 100).toFixed(0)}%` }}
        />
      </div>
      <span className="mono text-sm" style={{ color: 'var(--text-secondary)', minWidth: 36 }}>
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

export default function TransactionFeed({ transactions, onSimulate, loading }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.risk_level === filter);

  const formatTime = (ts) => {
    try {
      return new Date(ts + 'Z').toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return '—'; }
  };

  const formatAmount = (amt) =>
    typeof amt === 'number' ? `$${amt.toFixed(2)}` : '—';

  return (
    <div className="feed-card">
      <div className="feed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="section-title">Live Transaction Feed</span>
          <span className="live-badge">
            <span className="live-dot" />
            Live
          </span>
        </div>
        <div className="feed-controls">
          <div className="filter-chips">
            {['all', 'low', 'medium', 'high'].map((f) => (
              <button
                key={f}
                id={`filter-${f}`}
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            id="simulate-btn"
            className="btn btn-primary"
            onClick={onSimulate}
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : '⚡'}
            {loading ? 'Simulating…' : 'Simulate (20)'}
          </button>
        </div>
      </div>

      <div className="feed-table-wrapper">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">
              No transactions yet. Click <strong>Simulate</strong> to generate data.
            </div>
          </div>
        ) : (
          <table className="feed-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Risk Level</th>
                <th>Fraud Probability</th>
                <th>Fraud?</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id}>
                  <td className="mono text-muted text-sm">{tx.id}</td>
                  <td className="mono text-sm">{formatTime(tx.transaction_time)}</td>
                  <td className="mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatAmount(tx.amount)}
                  </td>
                  <td><RiskBadge level={tx.risk_level} /></td>
                  <td style={{ minWidth: 140 }}>
                    <ProbBar prob={tx.fraud_probability} level={tx.risk_level} />
                  </td>
                  <td>
                    {tx.is_fraud
                      ? <span className="text-red font-bold">✗ Fraud</span>
                      : <span className="text-green">✓ Normal</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
