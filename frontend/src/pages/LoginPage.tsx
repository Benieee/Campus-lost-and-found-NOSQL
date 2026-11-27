import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Sign In</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
            Access your student reports, ownership claims, or staff administration dashboard.
          </p>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.edu"
              />
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="muted small" style={{ marginTop: 18, textAlign: 'center' }}>
            New student?{' '}
            <Link to="/register" style={{ color: '#1d63dc', fontWeight: 600 }}>
              Create an account
            </Link>
          </p>

          <div className="alert alert-info" style={{ marginTop: 18, marginBottom: 0 }}>
            <div className="small">
              <strong>Local Demo Accounts (Fictional Seed Data):</strong>
              <br />
              Student: <code>amina.nakato@example.edu</code> / <code>StudentDemo!2026</code>
              <br />
              Staff Admin: <code>staff.admin@example.edu</code> / <code>StaffDemo!2026</code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
