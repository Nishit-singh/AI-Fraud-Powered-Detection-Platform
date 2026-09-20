import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts';

// Custom tooltip styling
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0d1426',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 13,
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' && p.value < 1
            ? `${(p.value * 100).toFixed(1)}%`
            : p.value}
        </p>
      ))}
    </div>
  );
};

export function FraudRateChart({ data }) {
  return (
    <div className="chart-card">
      <div className="chart-title">📈 Fraud Rate by Hour</div>
      {!data || data.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">Simulate transactions to see chart data</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
            />
            <Line
              type="monotone"
              dataKey="fraud_rate"
              name="Fraud Rate"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#ef4444' }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total Tx"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              yAxisId={0}
              hide
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const METRIC_COLORS = {
  precision: '#3b82f6',
  recall:    '#10b981',
  f1:        '#f59e0b',
  roc_auc:   '#8b5cf6',
};

export function ModelPerformanceChart({ metrics }) {
  const xgb = metrics?.model_metrics?.xgboost || {};
  const base = metrics?.model_metrics?.baseline || {};

  const data = ['precision', 'recall', 'f1', 'roc_auc'].map((m) => ({
    name: m === 'roc_auc' ? 'ROC-AUC' : m.charAt(0).toUpperCase() + m.slice(1),
    XGBoost: xgb[m] != null ? parseFloat((xgb[m] * 100).toFixed(1)) : 0,
    Baseline: base[m] != null ? parseFloat((base[m] * 100).toFixed(1)) : 0,
  }));

  return (
    <div className="chart-card">
      <div className="chart-title">🤖 Model Performance Comparison</div>
      {xgb.precision == null ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <div className="empty-state-icon">📉</div>
          <div className="empty-state-text">No metrics yet — run training scripts</div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v, name) => [`${v}%`, name]}
                contentStyle={{
                  background: '#0d1426',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
              <Bar dataKey="XGBoost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Baseline" fill="rgba(139,92,246,0.6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {xgb.note && (
            <p className="text-sm text-muted" style={{ marginTop: 8, textAlign: 'center' }}>
              ⚠️ {xgb.note}
            </p>
          )}
        </>
      )}
    </div>
  );
}
