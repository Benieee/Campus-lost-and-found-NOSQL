import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  IdCard,
  Lock,
  Mail,
  Phone,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    studentId: '',
    email: '',
    course: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedNotice) {
      setError('Please acknowledge the privacy notice before creating an account.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        studentId: form.studentId.trim(),
        email: form.email.trim(),
        course: form.course.trim(),
        phone: form.phone.trim(),
        password: form.password
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-scene">
      <Link to="/" className="auth-back-link">
        <ArrowLeft size={16} /> Back to Portal
      </Link>

      <div className="auth-glass-card wide">
        <div className="auth-crest-badge">
          <img src="/bugema-logo.jpg" alt="Bugema University crest" />
        </div>

        <h1 className="auth-glass-title">Create Account</h1>
        <p className="auth-glass-sub">
          Register with your student details to report items and track ownership claims.
        </p>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <label htmlFor="reg-name" className="sr-only">
              Full name
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <UserIcon size={17} />
              </span>
              <input
                id="reg-name"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Full name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-student-id" className="sr-only">
              Student ID
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <IdCard size={17} />
              </span>
              <input
                id="reg-student-id"
                required
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                placeholder="Student ID (e.g. 24/BIT/BU/R/0101)"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="sr-only">
              Email address
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <Mail size={17} />
              </span>
              <input
                id="reg-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-phone" className="sr-only">
              Phone number
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <Phone size={17} />
              </span>
              <input
                id="reg-phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone (+256-700-000000)"
              />
            </div>
          </div>

          <div className="form-full">
            <label htmlFor="reg-course" className="sr-only">
              Course or Academic Program
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <BookOpen size={17} />
              </span>
              <input
                id="reg-course"
                required
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                placeholder="Course / Program (e.g. BSc Information Technology)"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="sr-only">
              Password
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <Lock size={17} />
              </span>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Password (min 8 chars)"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm" className="sr-only">
              Confirm password
            </label>
            <div className="auth-input-pill">
              <span className="auth-input-icon" aria-hidden="true">
                <Lock size={17} />
              </span>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Confirm password"
              />
            </div>
          </div>

          <div className="form-full" style={{ padding: '2px 4px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acceptedNotice}
                onChange={(e) => setAcceptedNotice(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I have read the{' '}
                <Link to="/privacy" style={{ color: '#fff6d6', textDecoration: 'underline', fontWeight: 600 }}>
                  Privacy Notice
                </Link>{' '}
                and consent to storing these details for property matching and verification.
              </span>
            </label>
          </div>

          <div className="form-full">
            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              {submitting ? 'Creating Account…' : 'Create Student Account'}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 18, marginBottom: 0, textAlign: 'center', fontSize: '0.88rem' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: '#fff6d6', fontWeight: 700, textDecoration: 'underline' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
