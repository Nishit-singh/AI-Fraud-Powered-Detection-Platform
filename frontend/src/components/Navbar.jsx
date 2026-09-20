export default function Navbar({ backendOnline }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">🛡️</div>
        <div>
          <div className="navbar-title">Fraud Detection Platform</div>
          <div className="navbar-subtitle">PRJ_388 · SDG 16 · AI-Powered</div>
        </div>
      </div>
      <div className="navbar-right">
        <div className={`status-indicator`} style={{
          background: backendOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          borderColor: backendOnline ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
          color: backendOnline ? '#10b981' : '#ef4444',
        }}>
          <div className="status-dot" style={{
            background: backendOnline ? '#10b981' : '#ef4444',
          }} />
          {backendOnline ? 'API Online' : 'API Offline'}
        </div>
      </div>
    </nav>
  );
}
