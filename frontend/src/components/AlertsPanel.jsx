import { api } from '../api';

export default function AlertsPanel({ alerts, onReview }) {
  const unreviewed = alerts.filter((a) => !a.reviewed);

  const formatTime = (ts) => {
    try {
      const d = new Date(ts + 'Z');
      return d.toLocaleString('en-IN', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  };

  const handleReview = async (id) => {
    try {
      await api.reviewTransaction(id);
      onReview(id);
    } catch (e) {
      console.error('Review failed', e);
    }
  };

  return (
    <div className="alerts-panel">
      <div className="alerts-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="section-title">🚨 Flagged Alerts</span>
          {unreviewed.length > 0 && (
            <span className="alert-count-badge">{unreviewed.length}</span>
          )}
        </div>
        <span className="text-sm text-muted">High risk only</span>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <div className="empty-state-icon">🛡️</div>
          <div className="empty-state-text">No high-risk alerts</div>
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              id={`alert-${alert.id}`}
              className={`alert-item ${alert.reviewed ? 'reviewed' : ''}`}
            >
              <div className="alert-item-header">
                <span className="alert-item-amount">
                  ${typeof alert.amount === 'number' ? alert.amount.toFixed(2) : '—'}
                </span>
                <span className="alert-item-prob">
                  {(alert.fraud_probability * 100).toFixed(1)}% fraud
                </span>
              </div>
              <div className="alert-item-time">{formatTime(alert.transaction_time)}</div>
              {!alert.reviewed ? (
                <button
                  id={`review-btn-${alert.id}`}
                  className="btn btn-ghost btn-sm w-full"
                  onClick={() => handleReview(alert.id)}
                >
                  ✓ Mark Reviewed
                </button>
              ) : (
                <div className="text-sm text-muted" style={{ textAlign: 'center' }}>
                  ✓ Reviewed
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
