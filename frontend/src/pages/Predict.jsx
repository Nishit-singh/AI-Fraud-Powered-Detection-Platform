/**
 * Predict.jsx — Prediction Page (Prompt 6 + 6.1 + 7)
 *
 * Two tabs under /predict:
 *   • Manual  — single transaction with SHAP explanation (Prompt 6/6.1)
 *   • CSV Batch — upload a CSV, get a summary + per-row results (Prompt 7)
 *
 * DB persistence: manual → source="manual", csv → source="csv" (both backend-handled)
 */
import { useState, useRef } from 'react';
import { api } from '../api';

/* ── Sample values ────────────────────────────────────────────────────────── */

const FRAUD_SAMPLE = {
  Amount: 312.50,
  V1: -4.0,  V2: 0.8,   V3: -1.2,  V4: 3.1,   V5: -0.6,
  V6: -0.4,  V7: -2.1,  V8: 0.3,   V9: -0.9,  V10: -4.2,
  V11: 1.1,  V12: -4.3, V13: 0.2,  V14: -5.1, V15: 0.1,
  V16: -1.8, V17: -2.0, V18: -0.7, V19: 0.4,  V20: 0.2,
  V21: 0.5,  V22: -0.3, V23: 0.1,  V24: -0.2, V25: 0.3,
  V26: -0.1, V27: 0.2,  V28: 0.1,
};

/**
 * Borderline sample — interpolated at alpha=0.385 between the normal/fraud
 * archetypes using the actual trained model. Verified to produce ~43% fraud
 * probability (NORMAL, MEDIUM risk) from the real XGBoost model.
 * Features rounded to 4 dp for readability.
 */
const BORDERLINE_SAMPLE = {
  Amount: 153.71,
  V1: -0.6175, V2: 0.6155,  V3: -0.339,  V4: 1.255,  V5: -0.231,
  V6: -0.154,  V7: -0.8085, V8: 0.1155,  V9: -0.3465,V10: -1.617,
  V11: 0.4235, V12: -1.6555,V13: 0.077,  V14: -1.9635,V15: 0.0385,
  V16: -0.693, V17: -0.77,  V18: -0.2695,V19: 0.154, V20: 0.077,
  V21: 0.1925, V22: -0.1155,V23: 0.0385, V24: -0.077,V25: 0.1155,
  V26: -0.0385,V27: 0.077,  V28: 0.0385,
};

const NORMAL_SAMPLE = {
  Amount: 54.30,
  V1: 1.5,  V2: 0.5,  V3: 0.2,  V4: 0.1,  V5: 0.0,
  V6: 0.0,  V7: 0.0,  V8: 0.0,  V9: 0.0,  V10: 0.0,
  V11: 0.0, V12: 0.0, V13: 0.0, V14: 0.0, V15: 0.0,
  V16: 0.0, V17: 0.0, V18: 0.0, V19: 0.0, V20: 0.0,
  V21: 0.0, V22: 0.0, V23: 0.0, V24: 0.0, V25: 0.0,
  V26: 0.0, V27: 0.0, V28: 0.0,
};

const EMPTY_FORM = {
  Amount: '',
  ...Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`V${i + 1}`, 0])),
};

function buildPayload(form) {
  const payload = { Amount: parseFloat(form.Amount) || 0 };
  for (let i = 1; i <= 28; i++) {
    payload[`V${i}`] = parseFloat(form[`V${i}`]) || 0;
  }
  return payload;
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function ProbBar({ prob }) {
  const pct = Math.round(prob * 100);
  const color =
    pct >= 60 ? 'var(--accent-red)' :
    pct >= 30 ? 'var(--accent-yellow)' :
                'var(--accent-green)';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>Fraud Probability</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 4,
          background: color,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 10px ${color}66`,
        }} />
      </div>
    </div>
  );
}

function StrengthBar({ contribution, strength }) {
  const abs = Math.abs(contribution);
  const isFraud = contribution > 0;
  const color = isFraud ? 'var(--accent-red)' : 'var(--accent-green)';
  const pct = Math.min(Math.round((abs / 3.0) * 100), 100); // normalize to ~3 as max
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', width: 60 }}>
        {strength}
      </span>
    </div>
  );
}

function ExplanationSection({ explanation }) {
  if (!explanation) {
    return (
      <div className="expl-unavailable">
        ⚠️ Explanation unavailable for this prediction.
      </div>
    );
  }
  const { top_fraud_factors, top_normal_factors, note } = explanation;

  return (
    <div className="expl-section">
      <div className="expl-title">🔍 Why this prediction?</div>

      {top_fraud_factors.length > 0 && (
        <div className="expl-group">
          <div className="expl-group-label fraud">
            🔴 Factors contributing toward fraud
          </div>
          {top_fraud_factors.map((f) => (
            <div key={f.feature} className="expl-row">
              <span className="expl-feature">{f.feature}</span>
              <StrengthBar contribution={f.contribution} strength={f.strength} />
            </div>
          ))}
        </div>
      )}

      {top_normal_factors.length > 0 && (
        <div className="expl-group">
          <div className="expl-group-label normal">
            🟢 Factors contributing toward normal
          </div>
          {top_normal_factors.map((f) => (
            <div key={f.feature} className="expl-row">
              <span className="expl-feature">{f.feature}</span>
              <StrengthBar contribution={f.contribution} strength={f.strength} />
            </div>
          ))}
        </div>
      )}

      <div className="expl-note">{note}</div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

/* ── CSV Batch Tab ────────────────────────────────────────────────────────── */

function BatchTab() {
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef                   = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      setError('Please upload a .csv file.');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.predictBatch(file);
      if (res.detail) throw new Error(res.detail);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Upload failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const header = 'Amount,' + Array.from({length:28},(_,i)=>`V${i+1}`).join(',');
    const rows   = [
      '312.50,-4.0,0.8,-1.2,3.1,-0.6,-0.4,-2.1,0.3,-0.9,-4.2,1.1,-4.3,0.2,-5.1,0.1,-1.8,-2.0,-0.7,0.4,0.2,0.5,-0.3,0.1,-0.2,0.3,-0.1,0.2,0.1',
      '54.30,1.5,0.5,0.2,0.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
      '153.71,-0.6175,0.6155,-0.339,1.255,-0.231,-0.154,-0.8085,0.1155,-0.3465,-1.617,0.4235,-1.6555,0.077,-1.9635,0.0385,-0.693,-0.77,-0.2695,0.154,0.077,0.1925,-0.1155,0.0385,-0.077,0.1155,-0.0385,0.077,0.0385',
    ];
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='sample_batch.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const fraudPct = result && result.processed > 0
    ? ((result.fraud_flagged / result.processed) * 100).toFixed(1)
    : null;

  return (
    <div className="batch-layout">
      {/* Left: upload card */}
      <div className="card batch-upload-card">
        <div className="chart-title">📂 Upload CSV File</div>

        {/* Drop zone */}
        <div
          className={`batch-dropzone${dragOver ? ' drag-over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
          {file ? (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Drag & drop a CSV here
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                or click to browse
              </div>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {/* Format info */}
        <div className="batch-format-note">
          <strong>Required columns:</strong> Amount, V1–V28 (case-insensitive, any extra columns ignored).<br />
          <strong>Row limit:</strong> 5,000 rows per upload.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            id="batch-upload-btn"
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!file || loading}
            onClick={handleUpload}
          >
            {loading ? <><span className="btn-spinner" /> Processing…</> : '⚡ Run Batch Prediction'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={downloadSample} title="Download sample CSV">
            ⬇ Sample CSV
          </button>
        </div>

        {file && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setFile(null); setResult(null); setError(null); if(fileRef.current) fileRef.current.value=''; }}
          >
            ✕ Clear file
          </button>
        )}
      </div>

      {/* Right: results */}
      <div className="batch-result-col">
        {!result && !error && !loading && (
          <div className="card predict-result-empty">
            <div className="empty-state-icon" style={{ fontSize: 40 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12 }}>
              Awaiting CSV upload
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              Upload a CSV with Amount + V1–V28 columns.<br />
              Use <strong>⬇ Sample CSV</strong> to download a 3-row example.
            </div>
          </div>
        )}

        {error && (
          <div className="card predict-result-empty" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <div className="empty-state-icon">❌</div>
            <div style={{ fontSize: 13, color: 'var(--accent-red)', marginTop: 8, lineHeight: 1.6 }}>{error}</div>
          </div>
        )}

        {result && (
          <>
            {/* Summary cards */}
            <div className="batch-summary-grid">
              <div className="batch-stat-card blue">
                <div className="batch-stat-label">Total Rows</div>
                <div className="batch-stat-value">{result.total_rows.toLocaleString()}</div>
              </div>
              <div className="batch-stat-card green">
                <div className="batch-stat-label">Processed</div>
                <div className="batch-stat-value">{result.processed.toLocaleString()}</div>
              </div>
              <div className="batch-stat-card red">
                <div className="batch-stat-label">Fraud Flagged</div>
                <div className="batch-stat-value">{result.fraud_flagged.toLocaleString()}</div>
              </div>
              <div className="batch-stat-card yellow">
                <div className="batch-stat-label">Fraud Rate</div>
                <div className="batch-stat-value">{fraudPct ?? '—'}%</div>
              </div>
            </div>

            {/* Fraud rate bar */}
            {fraudPct !== null && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  <span>Fraud rate across batch</span>
                  <span style={{ fontWeight: 700, color: parseFloat(fraudPct) >= 50 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>
                    {fraudPct}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${fraudPct}%`,
                    background: parseFloat(fraudPct) >= 50 ? 'var(--accent-red)' : 'var(--accent-yellow)',
                    borderRadius: 4,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>✅ Normal: {result.normal.toLocaleString()}</span>
                  <span>🚨 Fraud: {result.fraud_flagged.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Errors table */}
            {result.errors.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div className="chart-title" style={{ marginBottom: 10 }}>
                  ⚠️ Row Errors ({result.errors.length})
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  <table className="feed-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e) => (
                        <tr key={e.row}>
                          <td className="mono">{e.row}</td>
                          <td style={{ color: 'var(--accent-yellow)' }}>{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DB note */}
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 6,
              border: '1px solid var(--border)',
            }}>
              <span>💾</span>
              {result.processed} transaction{result.processed !== 1 ? 's' : ''} saved with{' '}
              <code style={{ color: 'var(--text-secondary)' }}>source="csv"</code>.
              View in{' '}
              <a href="/transactions" style={{ color: 'var(--accent-blue)' }}>All Transactions</a>.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function Predict() {
  const [activeTab, setActiveTab] = useState('manual');  // 'manual' | 'batch'

  const [form, setForm]       = useState(EMPTY_FORM);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const fillSample = (sample) => {
    setForm({ ...EMPTY_FORM, ...sample });
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = buildPayload(form);
      const res = await api.predict(payload);
      if (res.detail) throw new Error(res.detail);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Prediction failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (level) =>
    level === 'high'   ? 'var(--accent-red)'   :
    level === 'medium' ? 'var(--accent-yellow)' :
                         'var(--accent-green)';

  return (
    <main className="main-content">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">⚡ Predict Transaction</h1>
        <p className="page-subtitle">
          Single transaction prediction with SHAP explanation, or batch-process a CSV file.
          Every submission is saved to the database.
        </p>
      </div>

      {/* Tab bar */}
      <div className="predict-tabs">
        <button
          id="tab-manual"
          className={`predict-tab${activeTab === 'manual' ? ' active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          🎯 Manual Prediction
        </button>
        <button
          id="tab-batch"
          className={`predict-tab${activeTab === 'batch' ? ' active' : ''}`}
          onClick={() => setActiveTab('batch')}
        >
          📂 CSV Batch
        </button>
      </div>

      {/* ── BATCH TAB ─────────────────────────────────────────── */}
      {activeTab === 'batch' && <BatchTab />}

      {/* ── MANUAL TAB ────────────────────────────────────────── */}
      {activeTab === 'manual' && (
      <div className="predict-layout">
        {/* ── LEFT: Form ──────────────────────────────────────── */}
        <form className="predict-form card" onSubmit={handleSubmit}>

          {/* Quick-fill row */}
          <div className="predict-quickfill">
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Quick Fill:
            </span>
            <button type="button" id="fill-fraud-btn"      className="btn btn-danger btn-sm" onClick={() => fillSample(FRAUD_SAMPLE)}>
              🚨 Sample Fraud
            </button>
            <button type="button" id="fill-borderline-btn" className="btn btn-warning btn-sm" onClick={() => fillSample(BORDERLINE_SAMPLE)}>
              ⚠️ Sample Borderline
            </button>
            <button type="button" id="fill-normal-btn"     className="btn btn-ghost btn-sm"  onClick={() => fillSample(NORMAL_SAMPLE)}>
              ✅ Sample Normal
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm(EMPTY_FORM); setResult(null); setError(null); }}>
              ↺ Reset
            </button>
          </div>

          {/* Amount */}
          <div className="predict-amount-row">
            <label className="predict-label" htmlFor="Amount">
              Amount (USD) <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <input
              id="Amount"
              name="Amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 149.62"
              className="predict-input predict-input-lg"
              value={form.Amount}
              onChange={handleChange}
            />
          </div>

          {/* V1-V28 compact grid */}
          <div>
            <div className="predict-label" style={{ marginBottom: 10 }}>
              PCA Features V1 – V28
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                (default 0)
              </span>
            </div>
            <div className="predict-v-grid">
              {Array.from({ length: 28 }, (_, i) => {
                const name = `V${i + 1}`;
                return (
                  <div key={name} className="predict-v-cell">
                    <label className="predict-v-label" htmlFor={name}>{name}</label>
                    <input
                      id={name}
                      name={name}
                      type="number"
                      step="0.0001"
                      className="predict-input predict-input-sm"
                      value={form[name]}
                      onChange={handleChange}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            id="predict-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? <><span className="btn-spinner" /> Analyzing…</> : '⚡ Run Prediction'}
          </button>
        </form>

        {/* ── RIGHT: Result column ─────────────────────────────── */}
        <div className="predict-result-col">

          {/* Awaiting */}
          {!result && !error && (
            <div className="card predict-result-empty">
              <div className="empty-state-icon" style={{ fontSize: 48 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12 }}>
                Awaiting prediction
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
                Fill the form and click <strong>Run Prediction</strong>.<br />
                Try <strong>⚠️ Sample Borderline</strong> to see how the model handles
                an ambiguous transaction with mixed signals.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="card predict-result-empty" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="empty-state-icon">❌</div>
              <div style={{ fontSize: 14, color: 'var(--accent-red)', marginTop: 8 }}>{error}</div>
            </div>
          )}

          {/* Result card */}
          {result && (
            <div className={`card predict-result-card ${result.is_fraud ? 'result-fraud' : 'result-normal'}`}>

              {/* Verdict */}
              <div className="predict-verdict">
                <div className="predict-verdict-icon">
                  {result.is_fraud ? '🚨' : '✅'}
                </div>
                <div>
                  <div className={`predict-verdict-label ${result.is_fraud ? 'fraud' : 'normal'}`}>
                    {result.is_fraud ? 'FRAUD DETECTED' : 'NORMAL'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {result.is_fraud
                      ? 'This transaction has been flagged as fraudulent.'
                      : 'No strong fraud indicators found in this transaction.'}
                  </div>
                </div>
              </div>

              {/* Probability bar */}
              <ProbBar prob={result.fraud_probability} />

              {/* Stats row */}
              <div className="predict-result-details">
                <div className="predict-result-stat">
                  <div className="predict-result-stat-label">Fraud Prob.</div>
                  <div className="predict-result-stat-value" style={{ color: riskColor(result.risk_level) }}>
                    {(result.fraud_probability * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="predict-result-stat">
                  <div className="predict-result-stat-label">Risk Level</div>
                  <span className={`risk-badge ${result.risk_level}`}>
                    {result.risk_level === 'high' ? '🔴' : result.risk_level === 'medium' ? '🟡' : '🟢'}
                    {' '}{result.risk_level.toUpperCase()}
                  </span>
                </div>
                <div className="predict-result-stat">
                  <div className="predict-result-stat-label">Verdict</div>
                  <span className={`risk-badge ${result.is_fraud ? 'high' : 'low'}`}>
                    {result.is_fraud ? 'FRAUD' : 'NORMAL'}
                  </span>
                </div>
              </div>

              {/* SHAP explanation */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <ExplanationSection explanation={result.explanation} />
              </div>

              {/* DB save note */}
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)',
                fontSize: 12, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>💾</span>
                Saved to database with{' '}
                <code style={{ color: 'var(--text-secondary)' }}>source="manual"</code>.
                View in{' '}
                <a href="/transactions" style={{ color: 'var(--accent-blue)' }}>All Transactions</a>.
              </div>
            </div>
          )}

          {/* How it works card */}
          <div className="card predict-info-card">
            <div className="chart-title">🧠 How It Works</div>
            <div className="predict-info-list">
              <div className="predict-info-item">
                <span className="predict-info-dot blue" />
                <span>XGBoost trained on <strong>284,807</strong> real credit-card transactions</span>
              </div>
              <div className="predict-info-item">
                <span className="predict-info-dot green" />
                <span>V1–V28 are PCA-transformed features from the Kaggle dataset</span>
              </div>
              <div className="predict-info-item">
                <span className="predict-info-dot yellow" />
                <span>Explanations use SHAP TreeExplainer on the actual trained model — not heuristics</span>
              </div>
              <div className="predict-info-item">
                <span className="predict-info-dot red" />
                <span>ROC-AUC <strong>0.9809</strong> · Recall <strong>84.7%</strong> · Precision <strong>80.6%</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}  {/* end activeTab === 'manual' */}
    </main>
  );
}
