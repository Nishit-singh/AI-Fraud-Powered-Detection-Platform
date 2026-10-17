/**
 * TransactionTable.jsx — Shared reusable table component (used by
 * AllTransactions, FraudTransactions, and HighRiskAlerts).
 *
 * Props:
 *   presetFilters  — object of fixed filters the parent locks in (not shown in filter bar)
 *   hiddenFilters  — array of filter keys the bar should hide (already set by preset)
 *   pageTitle      — string for the page <h1>
 *   pageIcon       — emoji prefix
 *   pageSubtitle   — string
 *   emptyMessage   — what to show when no rows found
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const SOURCE_LABELS = { simulate: '🤖 Simulated', manual: '🖊 Manual', csv: '📂 CSV' };

function fmt(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr + 'Z');
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

function ProbPill({ prob }) {
  const pct = Math.round(prob * 100);
  const color = pct >= 60 ? 'var(--accent-red)' : pct >= 30 ? 'var(--accent-yellow)' : 'var(--accent-green)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color }}>
      {pct}%
      <span style={{ width: 36, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'inline-block' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </span>
    </span>
  );
}

function Skeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="tx-skeleton-row">
      {Array.from({ length: 9 }).map((_, j) => (
        <td key={j}><div className="skeleton-cell" style={{ width: `${50 + (j * 13) % 40}%` }} /></td>
      ))}
    </tr>
  ));
}

/* ── Filter bar ───────────────────────────────────────────────────────────── */

function FilterBar({ filters, onChange, totalCount, hidden = [] }) {
  const show = (key) => !hidden.includes(key);
  return (
    <div className="tx-filter-bar">
      {show('prediction') && (
        <div className="tx-filter-group">
          <label className="tx-filter-label">Prediction</label>
          <select className="tx-filter-select" value={filters.prediction} onChange={e => onChange('prediction', e.target.value)}>
            <option value="">All</option>
            <option value="fraud">🚨 Fraud only</option>
            <option value="normal">✅ Normal only</option>
          </select>
        </div>
      )}

      {show('risk_level') && (
        <div className="tx-filter-group">
          <label className="tx-filter-label">Risk Level</label>
          <select className="tx-filter-select" value={filters.risk_level} onChange={e => onChange('risk_level', e.target.value)}>
            <option value="">All</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      )}

      {show('sources') && (
        <div className="tx-filter-group">
          <label className="tx-filter-label">Source</label>
          <select className="tx-filter-select" value={filters.source} onChange={e => onChange('source', e.target.value)}>
            <option value="">All</option>
            <option value="simulate">🤖 Simulated</option>
            <option value="manual">🖊 Manual</option>
            <option value="csv">📂 CSV</option>
          </select>
        </div>
      )}

      {show('reviewed') && (
        <div className="tx-filter-group">
          <label className="tx-filter-label">Reviewed</label>
          <select className="tx-filter-select" value={filters.reviewed} onChange={e => onChange('reviewed', e.target.value)}>
            <option value="">All</option>
            <option value="false">⏳ Unreviewed</option>
            <option value="true">✅ Reviewed</option>
          </select>
        </div>
      )}

      <div className="tx-filter-group">
        <label className="tx-filter-label">Per page</label>
        <select className="tx-filter-select" value={filters.page_size} onChange={e => onChange('page_size', e.target.value)}>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
        <span className="tx-count-badge">
          {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────────────────────────── */

function Pagination({ page, totalPages, onPrev, onNext, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  for (let p = start; p <= end; p++) pages.push(p);
  return (
    <div className="tx-pagination">
      <button className="tx-page-btn" onClick={onPrev} disabled={page <= 1}>← Prev</button>
      {start > 1 && <><button className="tx-page-btn" onClick={() => onPage(1)}>1</button><span className="tx-page-ellipsis">…</span></>}
      {pages.map(p => <button key={p} className={`tx-page-btn${p === page ? ' active' : ''}`} onClick={() => onPage(p)}>{p}</button>)}
      {end < totalPages && <><span className="tx-page-ellipsis">…</span><button className="tx-page-btn" onClick={() => onPage(totalPages)}>{totalPages}</button></>}
      <button className="tx-page-btn" onClick={onNext} disabled={page >= totalPages}>Next →</button>
      <span className="tx-page-info">Page {page} / {totalPages}</span>
    </div>
  );
}

/* ── Main exported component ─────────────────────────────────────────────── */

export default function TransactionTable({
  presetFilters = {},
  hiddenFilters = [],
  pageTitle,
  pageIcon = '📋',
  pageSubtitle,
  emptyMessage = 'No transactions match the current filters.',
  headerExtra = null,    // optional JSX rendered next to page title (e.g. stats row)
}) {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    prediction: '',
    risk_level: '',
    source: '',
    reviewed: '',
    page_size: '20',
    ...presetFilters,
  });
  const [page, setPage]           = useState(1);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [reviewing, setReviewing] = useState(new Set());
  const abortRef                  = useRef(null);

  const load = useCallback(async (currentFilters, currentPage) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const params = { page: currentPage, page_size: currentFilters.page_size };
      if (currentFilters.risk_level) params.risk_level = currentFilters.risk_level;
      if (currentFilters.source)     params.source     = currentFilters.source;
      if (currentFilters.prediction === 'fraud')  params.is_fraud = true;
      if (currentFilters.prediction === 'normal') params.is_fraud = false;
      if (currentFilters.reviewed === 'true')     params.reviewed = true;
      if (currentFilters.reviewed === 'false')    params.reviewed = false;

      const res = await api.getTransactions(params);
      if (!ctrl.signal.aborted) setData(res);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err.message || 'Failed to load transactions.');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page, load]);

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleReview = async (e, id) => {
    e.stopPropagation();
    if (reviewing.has(id)) return;
    setReviewing(prev => new Set(prev).add(id));
    try {
      await api.reviewTransaction(id);
      setData(prev => ({
        ...prev,
        items: prev.items.map(tx => tx.id === id ? { ...tx, reviewed: true } : tx),
      }));
    } catch { /* silently ignore */ }
    finally {
      setReviewing(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const totalPages = data ? Math.ceil(data.total / Number(filters.page_size)) : 0;

  return (
    <main className="main-content">
      <div className="page-header">
        <h1 className="page-title">{pageIcon} {pageTitle}</h1>
        {pageSubtitle && <p className="page-subtitle">{pageSubtitle}</p>}
      </div>

      {headerExtra}

      <FilterBar
        filters={filters}
        onChange={handleFilter}
        totalCount={data?.total ?? 0}
        hidden={hiddenFilters}
      />

      {error && (
        <div className="card" style={{ padding: 20, borderColor: 'rgba(239,68,68,0.3)', marginBottom: 16 }}>
          <span style={{ color: 'var(--accent-red)' }}>❌ {error}</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 16 }} onClick={() => load(filters, page)}>Retry</button>
        </div>
      )}

      <div className="card tx-table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="tx-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Fraud Prob.</th>
                <th>Prediction</th>
                <th>Risk</th>
                <th>Source</th>
                <th>Reviewed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <Skeleton rows={8} />}

              {!loading && !error && data?.items?.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div className="empty-state-icon" style={{ fontSize: 36 }}>🔍</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10 }}>{emptyMessage}</div>
                  </td>
                </tr>
              )}

              {!loading && data?.items?.map((tx) => (
                <tr key={tx.id} className="tx-row" onClick={() => navigate(`/transactions/${tx.id}`)}>
                  <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{tx.id}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(tx.transaction_time)}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>${tx.amount.toFixed(2)}</td>
                  <td><ProbPill prob={tx.fraud_probability} /></td>
                  <td>
                    <span className={`risk-badge ${tx.is_fraud ? 'high' : 'low'}`}>
                      {tx.is_fraud ? '🚨 FRAUD' : '✅ NORMAL'}
                    </span>
                  </td>
                  <td>
                    <span className={`risk-badge ${tx.risk_level}`}>
                      {tx.risk_level === 'high' ? '🔴' : tx.risk_level === 'medium' ? '🟡' : '🟢'}
                      {' '}{tx.risk_level.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {SOURCE_LABELS[tx.source] ?? tx.source}
                  </td>
                  <td>
                    {tx.reviewed
                      ? <span style={{ color: 'var(--accent-green)', fontSize: 12, fontWeight: 600 }}>✅ Done</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⏳ Pending</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => navigate(`/transactions/${tx.id}`)}>
                        🔍 View
                      </button>
                      {!tx.reviewed && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                          disabled={reviewing.has(tx.id)}
                          onClick={(e) => handleReview(e, tx.id)}>
                          {reviewing.has(tx.id) ? '…' : '✓ Review'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <Pagination page={page} totalPages={totalPages}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          onPage={setPage}
        />
      )}
    </main>
  );
}
