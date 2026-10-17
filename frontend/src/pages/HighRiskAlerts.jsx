/**
 * HighRiskAlerts.jsx — High-Risk Alerts page (Prompt 9)
 *
 * Pre-filters: risk_level=high (locked), reviewed=false (default but changeable)
 * Hidden controls: risk_level filter (already locked to high)
 *
 * Shows unreviewed high-risk transactions by default — the primary triage view.
 * Users can flip "Reviewed" to see already-reviewed high-risk transactions.
 */
import TransactionTable from '../components/TransactionTable';

function AlertBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', marginBottom: 18,
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 'var(--radius-lg)',
      fontSize: 13, color: 'var(--text-secondary)',
    }}>
      <span style={{ fontSize: 24 }}>🔴</span>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: 2 }}>
          High-Risk Alert Queue
        </div>
        <div>
          Transactions with fraud probability ≥ 60%. These require manual review.
          Use <strong>✓ Review</strong> on each row to clear it from the queue.
        </div>
      </div>
    </div>
  );
}

export default function HighRiskAlerts() {
  return (
    <TransactionTable
      pageIcon="⚠️"
      pageTitle="High Risk Alerts"
      pageSubtitle="Transactions flagged as high-risk (fraud probability ≥ 60%). Defaulting to unreviewed — clear the queue by marking each as reviewed."
      presetFilters={{ risk_level: 'high', reviewed: 'false' }}
      hiddenFilters={['risk_level']}
      emptyMessage="No unreviewed high-risk alerts. Switch the Reviewed filter to see previously reviewed transactions."
      headerExtra={<AlertBanner />}
    />
  );
}
