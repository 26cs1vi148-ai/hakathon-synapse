import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MapPin, RefreshCw, Shield, UserRound } from 'lucide-react';
import { getAlerts, updateStatus } from '../services/api';

export default function WardenPage() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadAlerts = async () => {
    try {
      const data = await getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('Could not load SOS alerts. Make sure the backend is running on port 5000.');
    }
  };

  useEffect(() => {
    loadAlerts();
    const source = new EventSource(
      `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}/sos/events`
    );
    source.onmessage = loadAlerts;
    return () => source.close();
  }, []);

  const activeAlerts = useMemo(
    () => alerts.filter((a) => ['ACTIVE', 'RESPONDED'].includes(a.status)),
    [alerts]
  );

  const markStatus = async (id, status) => {
    setBusyId(id);
    try {
      const updated = await updateStatus(id, status);
      setAlerts((items) => items.map((x) => x.id === id ? updated : x));
      setError('');
    } catch {
      setError('Could not update the SOS status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7fb', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Shield size={30} />
            <div>
              <h1 style={{ margin:0 }}>Warden Dashboard</h1>
              <p style={{ margin:'4px 0 0', color:'#64748b' }}>Live Campus SOS monitoring</p>
            </div>
          </div>
          <button onClick={loadAlerts} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #cbd5e1', background:'#fff' }}>
            <RefreshCw size={17} /> Refresh
          </button>
        </header>

        {error && <div style={{ padding:14, marginBottom:18, borderRadius:10, background:'#fee2e2', color:'#991b1b' }}>{error}</div>}

        <section style={{ padding:18, marginBottom:20, borderRadius:14, background:'#fff', border:'1px solid #e2e8f0' }}>
          <strong>{activeAlerts.length} active SOS alert{activeAlerts.length === 1 ? '' : 's'}</strong>
          <span style={{ marginLeft:10, color:'#64748b' }}>Same alerts created by the Student Dashboard</span>
        </section>

        {activeAlerts.length === 0 ? (
          <section style={{ padding:40, textAlign:'center', borderRadius:14, background:'#fff', border:'1px solid #e2e8f0' }}>
            <Shield size={42} />
            <h2>No active SOS</h2>
            <p style={{ color:'#64748b' }}>When a student presses SOS, the alert will appear here automatically.</p>
          </section>
        ) : (
          <div style={{ display:'grid', gap:16 }}>
            {activeAlerts.map((alert) => (
              <article key={alert.id} style={{ background:'#fff', border:'2px solid #ef4444', borderRadius:14, padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ color:'#b91c1c', fontWeight:800 }}>
                      <AlertTriangle size={20} style={{ verticalAlign:'middle' }} /> SOS {alert.status}
                    </div>
                    <h2 style={{ margin:'10px 0 4px' }}>{alert.name || 'Unknown student'}</h2>
                    <div style={{ color:'#475569' }}><UserRound size={15} style={{ verticalAlign:'middle' }} /> {alert.studentId || '—'}</div>
                  </div>
                  <div><strong>{alert.hostel || 'Hostel —'}</strong><div style={{ color:'#64748b' }}>Room {alert.room || '—'}</div></div>
                </div>

                <div style={{ marginTop:18, padding:14, borderRadius:10, background:'#f8fafc' }}>
                  <div><MapPin size={18} style={{ verticalAlign:'middle' }} /> <strong>Current location</strong></div>
                  <div style={{ marginTop:7 }}>{Number(alert.latitude).toFixed(6)}, {Number(alert.longitude).toFixed(6)}</div>
                  <a href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer">
                    Open location in Google Maps
                  </a>
                </div>

                <div style={{ marginTop:16, display:'flex', gap:10 }}>
                  {alert.status === 'ACTIVE' && (
                    <button disabled={busyId === alert.id} onClick={() => markStatus(alert.id, 'RESPONDED')}>
                      Mark Responded
                    </button>
                  )}
                  <button disabled={busyId === alert.id} onClick={() => markStatus(alert.id, 'RESOLVED')}>
                    Resolve
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
