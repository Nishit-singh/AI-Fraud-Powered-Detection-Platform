/**
 * App.jsx — Routes shell.
 * All dashboard logic lives in pages/Dashboard.jsx.
 * Navbar is always rendered; <Routes> swaps the page content.
 */
import { Routes, Route } from 'react-router-dom';
import './index.css';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Predict from './pages/Predict';
import AllTransactions from './pages/AllTransactions';
import FraudTransactions from './pages/FraudTransactions';
import HighRiskAlerts from './pages/HighRiskAlerts';
import TransactionDetail from './pages/TransactionDetail';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <div className="app-wrapper">
      <Navbar />
      <Routes>
        <Route path="/"                       element={<Dashboard />} />
        <Route path="/predict"                element={<Predict />} />
        <Route path="/transactions"           element={<AllTransactions />} />
        <Route path="/transactions/fraud"     element={<FraudTransactions />} />
        <Route path="/transactions/high-risk" element={<HighRiskAlerts />} />
        <Route path="/transactions/:id"       element={<TransactionDetail />} />
        <Route path="/analytics"              element={<Analytics />} />
      </Routes>
    </div>
  );
}
