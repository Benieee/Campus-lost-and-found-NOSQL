import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  const navLinks = (
    <>
      <NavLink to="/found" className="nav-link" onClick={() => setMenuOpen(false)}>
        Found Items
      </NavLink>
      <NavLink to="/lost" className="nav-link" onClick={() => setMenuOpen(false)}>
        Lost Reports
      </NavLink>
      {user && (
        <>
          <NavLink to="/report-lost" className="nav-link" onClick={() => setMenuOpen(false)}>
            Report Lost
          </NavLink>
          <NavLink to="/report-found" className="nav-link" onClick={() => setMenuOpen(false)}>
            Report Found
          </NavLink>
          <NavLink to="/my-submissions" className="nav-link" onClick={() => setMenuOpen(false)}>
            My Submissions
          </NavLink>
          <NavLink to="/dashboard" className="nav-link" onClick={() => setMenuOpen(false)}>
            Dashboard
          </NavLink>
        </>
      )}
      {user?.role === 'admin' && (
        <NavLink to="/admin" className="nav-link" onClick={() => setMenuOpen(false)}>
          Staff Admin
        </NavLink>
      )}
    </>
  );

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="project-ribbon" role="note">
        <div className="container">
          <span>
            <strong>Proposed University Project:</strong> Academic prototype for Bugema University using fictional demonstration data. Not officially deployed by the university.
          </span>
          <Link to="/privacy">Privacy Notice</Link>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark" aria-hidden="true">
              BU
            </span>
            <span>
              Bugema Lost &amp; Found
              <span className="brand-subtitle">Campus Property Recovery Portal</span>
            </span>
          </Link>

          <nav className="nav-desktop" aria-label="Primary navigation">
            {navLinks}
          </nav>

          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-chip" title={user.email}>
                  {user.role === 'admin' ? <ShieldCheck size={15} /> : <UserIcon size={15} />}
                  {user.fullName.split(' ')[0]} ({user.role === 'admin' ? 'Staff' : 'Student'})
                </span>
                <button type="button" className="btn btn-ghost-light btn-sm" onClick={handleLogout}>
                  <LogOut size={15} /> Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost-light btn-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="mobile-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
            Menu
          </button>
        </div>

        <nav id="mobile-navigation" className={`mobile-nav ${menuOpen ? 'open' : ''}`} aria-label="Mobile navigation">
          {navLinks}
          {user ? (
            <button type="button" className="btn btn-ghost-light btn-sm" onClick={handleLogout}>
              <LogOut size={15} /> Sign out ({user.fullName})
            </button>
          ) : (
            <div className="row-gap" style={{ marginTop: 8 }}>
              <Link to="/login" className="btn btn-ghost-light btn-sm" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>
                Register
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main id="main-content" className="main-content">
        {children}
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <strong style={{ color: '#fff' }}>Bugema University Campus Lost &amp; Found Management System</strong>
            <p style={{ margin: '6px 0 0', maxWidth: '58ch' }}>
              Proposed student project designed to help students report lost items, log found belongings, and support staff-verified ownership claims. Uses fictional seed data only.
            </p>
          </div>
          <div className="footer-links">
            <Link to="/found">Browse Found</Link>
            <Link to="/lost">Browse Lost</Link>
            <Link to="/privacy">Privacy Notice</Link>
            {user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Sign in</Link>}
          </div>
        </div>
      </footer>
    </div>
  );
}
