import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { api } from './api';
import Navbar from './components/Navbar';
import SummaryCards from './components/SummaryCards';
import TransactionFeed from './components/TransactionFeed';
import AlertsPanel from './components/AlertsPanel';
import { FraudRateChart, ModelPerformanceChart } from './components/Charts';

const POLL_INTERVAL = 5000; // 5s

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [transactions, setTransactions]   = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [metrics, setMetrics]             = useState(null);
  const [hourlyData, setHourlyData]       = useState([]);
  const [simulating, setSimulating]       = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [toasts, setToasts]               = useState([]);
  const pollRef = useRef(null);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.getTransactions({ page_size: 50 });
      if (data.items) {
        setTransactions(data.items);
        setAlerts(data.items.filter((t) => t.risk_level === 'high'));
      }
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.getMetrics();
      setMetrics(data);
    } catch { /* silent */ }
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

  // Initial load + polling
  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await api.simulate(20, 0.15);
      addToast(
        `✓ Simulated 20 transactions — ${res.fraud_flagged} fraud flagged`,
        'success'
      );
      await fetchAll();
    } catch (e) {
      addToast('✗ Simulation failed — is the backend running?', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleReview = useCallback((id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, reviewed: true } : a))
    );
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reviewed: true } : t))
    );
    addToast('✓ Alert marked as reviewed', 'success');
  }, [addToast]);

  return (
    <div className="app-wrapper">
      <Navbar backendOnline={backendOnline} />

      <main className="main-content">
        {/* Summary Cards */}
        <SummaryCards metrics={metrics} liveStats={metrics?.live_stats} />

        {/* Transaction Feed */}
        <TransactionFeed
          transactions={transactions}
          onSimulate={handleSimulate}
          loading={simulating}
        />

        {/* Charts + Alerts */}
        <div className="dashboard-grid">
          <div className="charts-col">
            <FraudRateChart data={hourlyData} />
            <ModelPerformanceChart metrics={metrics} />
          </div>
          <div className="alerts-col">
            <AlertsPanel alerts={alerts} onReview={handleReview} />
          </div>
        </div>
      </main>

      <Toast toasts={toasts} />
    </div>
  );
}
