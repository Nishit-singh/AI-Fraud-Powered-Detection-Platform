/**
 * Navbar.jsx — Persistent navigation bar.
 * Manages its own API health check so it's decoupled from page-level state.
 * Uses NavLink for active-state highlighting on the current route.
 */
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const API_HEALTH = 'http://localhost:8000/health';

export default function Navbar() {
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(API_HEALTH);
        setBackendOnline(r.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 10000); // re-check every 10 s
    return () => clearInterval(interval);
  }, []);

  const navItem = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  return (
    <nav className="navbar">
      {/* Brand — clicking navigates to home */}
      <NavLink to="/" className="navbar-brand-link">
        <div className="navbar-brand">
          <div className="navbar-logo">🛡️</div>
          <div>
            <div className="navbar-title">Fraud Detection Platform</div>
            <div className="navbar-subtitle">PRJ_388 · SDG 16 · AI-Powered</div>
          </div>
        </div>
      </NavLink>

      {/* Nav links */}
      <div className="navbar-nav">
        <NavLink to="/"                       end className={navItem}>Dashboard</NavLink>
        <NavLink to="/predict"                    className={navItem}>Predict</NavLink>
        <NavLink to="/transactions"               className={navItem}>Transactions</NavLink>
        <NavLink to="/transactions/fraud"         className={navItem}>Fraud</NavLink>
        <NavLink to="/transactions/high-risk"     className={navItem}>High Risk</NavLink>
        <NavLink to="/analytics"                  className={navItem}>Analytics</NavLink>
      </div>

      {/* Status indicator */}
      <div className="navbar-right">
        <div
          className="status-indicator"
          style={{
            background:   backendOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            borderColor:  backendOnline ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
            color:        backendOnline ? '#10b981' : '#ef4444',
          }}
        >
          <div className="status-dot" style={{ background: backendOnline ? '#10b981' : '#ef4444' }} />
          {backendOnline ? 'API Online' : 'API Offline'}
        </div>
      </div>
    </nav>
  );
}
