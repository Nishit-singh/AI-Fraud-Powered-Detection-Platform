const API_BASE = 'http://localhost:8000/api';

export const api = {
  // Predict fraud for one transaction
  predict: (features) =>
    fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    }).then((r) => r.json()),

  // Simulate N transactions
  simulate: (n = 20, fraudRate = 0.15) =>
    fetch(`${API_BASE}/transactions/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n, fraud_rate: fraudRate }),
    }).then((r) => r.json()),

  // Get paginated transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams({ page: 1, page_size: 50, ...params });
    return fetch(`${API_BASE}/transactions?${q}`).then((r) => r.json());
  },

  // Get metrics + live stats
  getMetrics: () => fetch(`${API_BASE}/metrics`).then((r) => r.json()),

  // Mark transaction as reviewed
  reviewTransaction: (id) =>
    fetch(`${API_BASE}/transactions/${id}/review`, { method: 'PUT' }).then((r) =>
      r.json()
    ),

  // Hourly fraud stats for chart
  getHourlyStats: () =>
    fetch(`${API_BASE}/transactions/stats/hourly`).then((r) => r.json()),
};
