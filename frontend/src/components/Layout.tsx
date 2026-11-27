import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bot,
  ChevronDown,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PackageCheck,
  PlusCircle,
  Search,
  Shield,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CampusSearchBackdrop } from './CampusSearchBackdrop';
import { FloatingAiBot } from './FloatingAiBot';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Campus Portal',
  '/found': 'Found Items Directory',
  '/lost': 'Lost-Item Reports',
  '/report-lost': 'Report Lost Item',
  '/report-found': 'Report Found Item',
  '/my-submissions': 'My Submissions & Claims',
  '/dashboard': 'Dashboard',
  '/admin': 'Admin Dashboard',
  '/assistant': 'AI Student Support Assistant',
  '/privacy': 'Privacy Notice'
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  // Render full-screen wave glass layout without sidebar on Sign In / Register routes
  const isAuthScreen = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    setDrawerOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen && !accountMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setAccountMenuOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [drawerOpen, accountMenuOpen]);

  if (isAuthScreen) {
    return (
      <>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
      </>
    );
  }

  const handleLogout = async (redirectTo: '/' | '/login' = '/') => {
    await logout();
    setDrawerOpen(false);
    setAccountMenuOpen(false);
    navigate(redirectTo);
  };

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = quickQuery.trim() ? `?q=${encodeURIComponent(quickQuery.trim())}` : '';
    navigate(`/found${qs}`);
  };

  const pageTitle =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/found/')
      ? 'Found Item Details'
      : location.pathname.startsWith('/lost/')
      ? 'Lost Report Details'
      : location.pathname.startsWith('/claims/new/')
      ? 'Submit Ownership Claim'
      : 'Bugema Lost & Found');

  const initials = user
    ? user.fullName
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'BU';

  return (
    <div className="workspace-shell">
      <CampusSearchBackdrop />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {drawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${drawerOpen ? 'mobile-open' : ''}`} aria-label="Primary sidebar">
        <div className="sidebar-brand">
          <img src="/bugema-logo.jpg" alt="Bugema University crest" className="brand-logo" />
          <div style={{ minWidth: 0 }}>
            <div className="brand-title">Bugema L&amp;F</div>
            <span className="brand-subtitle">Excellence in Services</span>
          </div>
          {drawerOpen && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto', padding: '6px 8px', minHeight: 32 }}
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="sidebar-section-label">Explore</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink to="/" end className="sidebar-link">
            <Home size={18} /> Home Overview
          </NavLink>
          <NavLink to="/found" className="sidebar-link">
            <PackageCheck size={18} /> Found Items
          </NavLink>
          <NavLink to="/lost" className="sidebar-link">
            <Search size={18} /> Lost Reports
          </NavLink>
          <NavLink to="/assistant" className="sidebar-link">
            <Bot size={18} /> AI Support Assistant
          </NavLink>
        </nav>

        {user && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">My Workspace</div>
            <nav className="sidebar-nav" aria-label="User navigation">
              <NavLink to="/dashboard" className="sidebar-link">
                <LayoutDashboard size={18} /> Dashboard
              </NavLink>
              <NavLink to="/report-lost" className="sidebar-link">
                <PlusCircle size={18} /> Report Lost
              </NavLink>
              <NavLink to="/report-found" className="sidebar-link">
                <PlusCircle size={18} /> Report Found
              </NavLink>
              <NavLink to="/my-submissions" className="sidebar-link">
                <ClipboardList size={18} /> My Submissions
              </NavLink>
            </nav>
          </>
        )}

        {user?.role === 'admin' && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Administration</div>
            <nav className="sidebar-nav" aria-label="Admin navigation">
              <NavLink to="/admin" className="sidebar-link sidebar-link-admin">
                <ShieldCheck size={18} /> Admin Panel
              </NavLink>
            </nav>
          </>
        )}

        <div className="sidebar-footer">
          <NavLink to="/privacy" className="sidebar-link">
            <Shield size={18} /> Privacy Notice
          </NavLink>
          {user ? (
            <button type="button" className="btn btn-signout btn-sm" onClick={() => void handleLogout('/')}>
              <LogOut size={15} /> Sign Out
            </button>
          ) : (
            <div className="row-gap">
              <Link to="/login" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                <LogIn size={15} /> Sign In
              </Link>
              <Link to="/register" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                <UserPlus size={15} /> Register
              </Link>
            </div>
          )}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-expanded={drawerOpen}
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen((prev) => !prev)}
            >
              <Menu size={18} /> Menu
            </button>
            <div>
              <div className="topbar-greeting">
                {user ? `Welcome back, ${user.fullName.split(' ')[0]}` : 'Bugema University Campus'}
              </div>
              <div className="topbar-title">{pageTitle}</div>
            </div>
          </div>

          <div className="topbar-right">
            <form onSubmit={handleQuickSearch} className="topbar-search-form" role="search">
              <Search size={16} aria-hidden="true" />
              <label htmlFor="topbar-search" className="sr-only">
                Search found property
              </label>
              <input
                id="topbar-search"
                type="search"
                placeholder="Search found items…"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
              />
            </form>

            {user ? (
              <div className="topbar-account-group" ref={accountMenuRef}>
                <button
                  type="button"
                  className="topbar-profile-pill"
                  title={user.email}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                >
                  <span className={`avatar-circle ${user.role === 'admin' ? 'admin' : ''}`}>
                    {initials}
                  </span>
                  <span className="profile-text">
                    <span className="profile-name">{user.fullName.split(' ').slice(0, 2).join(' ')}</span>
                    <span className="profile-role">{user.role === 'admin' ? 'Administrator' : 'Student'}</span>
                  </span>
                  <ChevronDown size={15} className="profile-chevron" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="btn btn-signout btn-sm topbar-signout-btn"
                  onClick={() => void handleLogout('/')}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={15} />
                  <span className="signout-label">Sign Out</span>
                </button>

                {accountMenuOpen && (
                  <div className="account-dropdown" role="menu">
                    <div className="account-dropdown-head">
                      <strong>{user.fullName}</strong>
                      <div className="muted small">{user.email}</div>
                      <div className="muted small">{user.studentId}</div>
                    </div>
                    <Link
                      to="/dashboard"
                      className="account-dropdown-item"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <LayoutDashboard size={15} /> My Dashboard
                    </Link>
                    <Link
                      to="/my-submissions"
                      className="account-dropdown-item"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <ClipboardList size={15} /> My Submissions &amp; Claims
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="account-dropdown-item"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <ShieldCheck size={15} /> Admin Dashboard
                      </Link>
                    )}
                    <div className="account-dropdown-divider" />
                    <button
                      type="button"
                      className="account-dropdown-item"
                      role="menuitem"
                      onClick={() => void handleLogout('/login')}
                    >
                      <ArrowLeftRight size={15} /> Switch Account
                    </button>
                    <button
                      type="button"
                      className="account-dropdown-item danger"
                      role="menuitem"
                      onClick={() => void handleLogout('/')}
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="row-gap">
                <Link to="/login" className="btn btn-secondary btn-sm">
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Register
                </Link>
              </div>
            )}
          </div>
        </header>

        <main id="main-content" className="main-content">
          {children}
        </main>

        <footer className="site-footer">
          <div className="footer-grid">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/bugema-logo.jpg"
                alt="Bugema University crest"
                className="brand-logo"
                style={{ width: 34, height: 34 }}
              />
              <span>
                <strong>Bugema University Campus Lost &amp; Found</strong> · Proposed student project
                using fictional demo data.
              </span>
            </div>
            <div className="footer-links">
              <Link to="/found">Found Items</Link>
              <Link to="/lost">Lost Reports</Link>
              <Link to="/privacy">Privacy Notice</Link>
            </div>
          </div>
        </footer>
      </div>

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
      <FloatingAiBot />
    </div>
  );
}
