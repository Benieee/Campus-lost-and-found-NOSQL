import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  PlusCircle,
  Search,
  ShieldCheck,
  User as UserIcon,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand-mark" aria-hidden="true">
              BU
            </span>
            <span>
              Bugema Lost &amp; Found
              <span className="brand-subtitle">Campus Property Recovery Portal</span>
            </span>
          </Link>

          <nav className="nav-desktop" aria-label="Primary navigation">
            <NavLink to="/found" className="nav-link">
              Found Items
            </NavLink>
            <NavLink to="/lost" className="nav-link">
              Lost Reports
            </NavLink>
            {user && (
              <>
                <NavLink to="/report-lost" className="nav-link">
                  Report Lost
                </NavLink>
                <NavLink to="/report-found" className="nav-link">
                  Report Found
                </NavLink>
                <NavLink to="/my-submissions" className="nav-link">
                  My Submissions
                </NavLink>
                <NavLink to="/dashboard" className="nav-link">
                  Dashboard
                </NavLink>
              </>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className="nav-link nav-link-admin">
                Admin Panel
              </NavLink>
            )}
          </nav>

          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-chip" title={`${user.fullName} (${user.email})`}>
                  {user.role === 'admin' ? <ShieldCheck size={15} /> : <UserIcon size={15} />}
                  {user.fullName.split(' ')[0]} · {user.role === 'admin' ? 'Admin' : 'Student'}
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
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen && <div className="mobile-drawer-backdrop" onClick={closeMenu} aria-hidden="true" />}

        <nav
          id="mobile-navigation"
          className={`mobile-nav ${menuOpen ? 'open' : ''}`}
          aria-label="Mobile navigation"
        >
          <NavLink to="/" end className="nav-link" onClick={closeMenu}>
            <Home size={17} /> Home
          </NavLink>
          <NavLink to="/found" className="nav-link" onClick={closeMenu}>
            <PackageCheck size={17} /> Found Items
          </NavLink>
          <NavLink to="/lost" className="nav-link" onClick={closeMenu}>
            <Search size={17} /> Lost Reports
          </NavLink>
          {user && (
            <>
              <NavLink to="/report-lost" className="nav-link" onClick={closeMenu}>
                <PlusCircle size={17} /> Report Lost Item
              </NavLink>
              <NavLink to="/report-found" className="nav-link" onClick={closeMenu}>
                <PlusCircle size={17} /> Report Found Item
              </NavLink>
              <NavLink to="/my-submissions" className="nav-link" onClick={closeMenu}>
                <ClipboardList size={17} /> My Submissions &amp; Claims
              </NavLink>
              <NavLink to="/dashboard" className="nav-link" onClick={closeMenu}>
                <LayoutDashboard size={17} /> My Dashboard
              </NavLink>
            </>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="nav-link nav-link-admin" onClick={closeMenu}>
              <ShieldCheck size={17} /> Admin Dashboard
            </NavLink>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 8, paddingTop: 12 }}>
            {user ? (
              <button
                type="button"
                className="btn btn-ghost-light"
                style={{ width: '100%' }}
                onClick={handleLogout}
              >
                <LogOut size={16} /> Sign out ({user.fullName})
              </button>
            ) : (
              <div className="row-gap">
                <Link to="/login" className="btn btn-ghost-light" style={{ flex: 1 }} onClick={closeMenu}>
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary" style={{ flex: 1 }} onClick={closeMenu}>
                  Register
                </Link>
              </div>
            )}
          </div>
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
              Student project portal for reporting lost property, logging found belongings, and managing
              staff-verified ownership claims. Uses fictional demonstration data only.
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

      <nav className="mobile-bottom-nav" aria-label="Quick mobile navigation">
        <NavLink to="/" end className="mobile-bottom-link">
          <Home size={19} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/found" className="mobile-bottom-link">
          <PackageCheck size={19} />
          <span>Found</span>
        </NavLink>
        <NavLink to={user ? '/report-lost' : '/lost'} className="mobile-bottom-link">
          {user ? <PlusCircle size={19} /> : <Search size={19} />}
          <span>{user ? 'Report' : 'Lost'}</span>
        </NavLink>
        <NavLink
          to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login'}
          className="mobile-bottom-link"
        >
          {user?.role === 'admin' ? <ShieldCheck size={19} /> : <UserIcon size={19} />}
          <span>{user ? (user.role === 'admin' ? 'Admin' : 'Account') : 'Sign in'}</span>
        </NavLink>
      </nav>
    </div>
  );
}
