import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="card">
          <img src="/bugema-logo.jpg" alt="Bugema University logo" className="auth-logo" />
          <h1 style={{ marginTop: 0, marginBottom: 6, textAlign: 'center' }}>Sign In</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20, textAlign: 'center' }}>
            Access your student reports, ownership claims, or the Admin Control Center.
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
                placeholder="name@example.edu"
              />
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="login-password">Password</label>
              <div className="password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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

          <div className="card card-compact" style={{ marginTop: 18, background: '#f8fafc' }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
              Quick Demo Sign-In (Fictional Seed Data)
            </div>
            <div className="row-gap">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  setEmail('amina.nakato@example.edu');
                  setPassword('StudentDemo!2026');
                }}
              >
                <UserIcon size={14} /> Fill Student
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  setEmail('staff.admin@example.edu');
                  setPassword('StaffDemo!2026');
                }}
              >
                <ShieldCheck size={14} /> Fill Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
