import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function StudentLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const change = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );
      navigate('/student-dashboard');
    } catch (err) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f5f7fb', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff',
        borderRadius: 18, padding: 32,
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Shield size={40} color="#2563eb" />
          <h1 style={{ margin: '12px 0 4px' }}>Student Login</h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Campus SOS Emergency System
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#991b1b',
            padding: 14, borderRadius: 10, marginBottom: 20
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            Email
            <input
              type="email" name="email"
              value={form.email} onChange={change}
              placeholder="student@example.com"
              required style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 20 }}>
            Password
            <input
              type="password" name="password"
              value={form.password} onChange={change}
              placeholder="Enter your password"
              required style={inputStyle}
            />
          </label>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 14, border: 'none',
            borderRadius: 10,
            background: loading ? '#999' : '#2563eb',
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', marginTop: 20,
          color: '#64748b', fontSize: 14
        }}>
          No account? Ask your warden to scan you in.
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  padding: '12px', marginTop: 7,
  border: '1px solid #d1d5db', borderRadius: 9, fontSize: 15
};