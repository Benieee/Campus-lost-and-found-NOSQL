import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    <div className="auth-scene">
      <Link to="/" className="auth-back-link">
        <ArrowLeft size={16} /> Back to Portal
      </Link>

      <div className="auth-glass-card">
        <div className="auth-crest-badge">
          <img src="/bugema-logo.jpg" alt="Bugema University crest" />
        </div>

        <h1 className="auth-glass-title">Sign In</h1>
        <p className="auth-glass-sub">Bugema University Campus Lost &amp; Found</p>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14 }}>
          <div>
            <label htmlFor="login-email" className="sr-only">
              Email address
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <Mail size={18} />
              </span>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="sr-only">
              Password
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" style={{ marginTop: 6 }} disabled={submitting}>
            {submitting ? 'Signing In…' : 'Login'}
          </button>

          <div className="row-between" style={{ fontSize: '0.84rem', padding: '2px 6px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <Link to="/register" style={{ color: '#fff6d6', fontWeight: 600, textDecoration: 'underline' }}>
              Create account
            </Link>
          </div>
        </form>

        <div className="auth-demo-box">
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', marginBottom: 10, opacity: 0.92 }}>
            Quick Demo Sign-In (Fictional Seed Accounts)
          </div>
          <div className="row-gap">
            <button
              type="button"
              className="btn btn-ghost-light btn-sm"
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
              className="btn btn-white btn-sm"
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
  );
}
