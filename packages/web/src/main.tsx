import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Health = { status: string; database: boolean; version: string };

// Phase 4 replaces this with the real scouting page from the Draft 2 design.
function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError('API not reachable — is `npm run dev:api` running?'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '80px auto', padding: 16 }}>
      <h1>Kestrel</h1>
      <p>Prep for your next round. Scouting arrives in Phase 4.</p>
      {error && <p style={{ color: '#b33430' }}>{error}</p>}
      {health && (
        <p>
          API: <strong>{health.status}</strong> · database {health.database ? 'connected' : 'down'} · v{health.version}
        </p>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
