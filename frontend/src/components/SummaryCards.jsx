export default function SummaryCards({ metrics, liveStats }) {
  const xgb = metrics?.model_metrics?.xgboost || {};
  const stats = liveStats || metrics?.live_stats || {};

  const fraudRate = stats.fraud_rate != null
    ? `${(stats.fraud_rate * 100).toFixed(2)}%`
    : '—';

  const cards = [
    {
      icon: '🔄',
      color: 'blue',
      label: 'Total Transactions',
      value: (stats.total_transactions ?? '—').toLocaleString?.() ?? '—',
      sub: 'All time',
    },
    {
      icon: '🚨',
      color: 'red',
      label: 'Fraud Detected',
      value: (stats.fraud_detected ?? '—').toLocaleString?.() ?? '—',
      sub: `${stats.unreviewed_alerts ?? 0} unreviewed`,
    },
    {
      icon: '📊',
      color: 'yellow',
      label: 'Fraud Rate',
      value: fraudRate,
      sub: 'Of all transactions',
    },
    {
      icon: '⚠️',
      color: 'red',
      label: 'High Risk',
      value: (stats.high_risk_count ?? '—').toLocaleString?.() ?? '—',
      sub: 'Flagged as high risk',
    },
    {
      icon: '🎯',
      color: 'green',
      label: 'Model Recall',
      value: xgb.recall != null ? `${(xgb.recall * 100).toFixed(1)}%` : '—',
      sub: 'Fraud caught',
    },
    {
      icon: '✅',
      color: 'purple',
      label: 'Precision',
      value: xgb.precision != null ? `${(xgb.precision * 100).toFixed(1)}%` : '—',
      sub: 'Alert accuracy',
    },
  ];

  return (
    <div className="summary-grid">
      {cards.map((c) => (
        <div key={c.label} className={`summary-card ${c.color}`}>
          <div className={`card-icon ${c.color}`}>{c.icon}</div>
          <div className="card-info">
            <div className="card-label">{c.label}</div>
            <div className="card-value">{c.value}</div>
            <div className="card-sub">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
