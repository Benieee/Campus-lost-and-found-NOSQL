import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <section className="page-section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <img src="/bugema-logo.jpg" alt="Bugema University logo" className="auth-logo" />
          <h1 style={{ marginTop: 0, marginBottom: 6, textAlign: 'center' }}>Student Registration</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20, textAlign: 'center' }}>
            Only the details required to identify your reports and contact you for verified property
            returns are collected.
          </p>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field">
              <label htmlFor="reg-name">Full name</label>
              <input
                id="reg-name"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Amina Nakato"
              />
            </div>

            <div className="field">
              <label htmlFor="reg-student-id">Student ID</label>
              <input
                id="reg-student-id"
                required
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                placeholder="e.g. 24/BIT/BU/R/0101"
              />
            </div>

            <div className="field">
              <label htmlFor="reg-email">Email address</label>
              <input
                id="reg-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.edu"
              />
            </div>

            <div className="field">
              <label htmlFor="reg-phone">Phone number</label>
              <input
                id="reg-phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+256-700-000000"
              />
            </div>

            <div className="field form-full">
              <label htmlFor="reg-course">Course / Academic Program</label>
              <input
                id="reg-course"
                required
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                placeholder="e.g. BSc Information Technology"
              />
            </div>

            <div className="field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="field">
              <label htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm"
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
              />
            </div>

            <div className="form-full">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={acceptedNotice}
                  onChange={(e) => setAcceptedNotice(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  I have read the{' '}
                  <Link to="/privacy" style={{ color: '#1d63dc', textDecoration: 'underline' }}>
                    Privacy Notice
                  </Link>{' '}
                  and understand this is a proposed university project system.
                </span>
              </label>
            </div>

            <div className="form-full">
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create Student Account'}
              </button>
            </div>
          </form>

          <p className="muted small" style={{ marginTop: 18, textAlign: 'center' }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: '#1d63dc', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
