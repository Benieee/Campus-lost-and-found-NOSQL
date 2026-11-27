import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, MapPin, Package, Search, ShieldCheck } from 'lucide-react';
import { foundItemsApi, publicApi, resolveMediaUrl } from '../api/client';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { FoundItem } from '../types';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState<{ openLostReports: number; foundInStorage: number; returnedItems: number } | null>(null);
  const [recentFound, setRecentFound] = useState<FoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([publicApi.summary(), foundItemsApi.list({ limit: 6, page: 1 })])
      .then(([sumRes, foundRes]) => {
        if (!mounted) return;
        setSummary(sumRes.counts);
        setRecentFound(foundRes.items);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load latest campus listings.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = searchTerm.trim() ? `?q=${encodeURIComponent(searchTerm.trim())}` : '';
    navigate(`/found${qs}`);
  };

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-blue">Bugema University — Proposed Project</span>
            <h1>Report lost items, browse found property, and verify ownership safely.</h1>
            <p>
              A centralized campus lost-and-found portal designed for Bugema University students and
              authorized staff. Sensitive identifying details are kept private so only genuine owners can
              claim stored property.
            </p>
            <div className="hero-actions">
              {user ? (
                <>
                  <Link to="/report-lost" className="btn btn-primary">
                    Report a Lost Item
                  </Link>
                  <Link to="/report-found" className="btn btn-ghost-light">
                    Report a Found Item
                  </Link>
                  <Link to="/found" className="btn btn-ghost-light">
                    Browse Found Items
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary">
                    Create Student Account
                  </Link>
                  <Link to="/login" className="btn btn-ghost-light">
                    Sign In
                  </Link>
                  <Link to="/found" className="btn btn-ghost-light">
                    Browse Found Items
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="hero-panel">
            <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>Quick search found items</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
              Search by item name, category keyword, or campus building.
            </p>
            <form onSubmit={handleSearch} className="search-inline" role="search">
              <label htmlFor="hero-search" className="skip-link">
                Search found items
              </label>
              <input
                id="hero-search"
                type="search"
                placeholder="e.g. calculator, charger, library..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Search size={16} /> Search
              </button>
            </form>

            {summary && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(255,255,255,0.18)'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{summary.openLostReports}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.82 }}>Open Lost</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{summary.foundInStorage}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.82 }}>Found Held</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{summary.returnedItems}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.82 }}>Returned</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="page-header">
            <div>
              <h2 style={{ margin: 0 }}>Recently Logged Found Property</h2>
              <p className="muted">
                Public summaries omit sensitive identifying marks. Sign in to submit an ownership claim.
              </p>
            </div>
            <Link to="/found" className="btn btn-secondary">
              View all found items
            </Link>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading-state" role="status">
              Loading recent found items…
            </div>
          ) : recentFound.length === 0 ? (
            <div className="empty-state">
              <p>No found items are currently listed.</p>
            </div>
          ) : (
            <div className="items-grid">
              {recentFound.map((item) => (
                <article key={item.id} className="item-card">
                  <div className="item-thumb">
                    {item.imageUrl ? (
                      <img src={resolveMediaUrl(item.imageUrl)} alt={item.itemName} />
                    ) : (
                      <Package size={40} aria-hidden="true" />
                    )}
                  </div>
                  <div className="item-card-body">
                    <div className="row-between">
                      <span className="badge badge-blue">{item.category}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <h3 className="item-card-title">{item.itemName}</h3>
                    <p className="item-card-desc">{item.description}</p>
                    <div className="item-meta">
                      <span className="item-meta-row">
                        <MapPin size={14} aria-hidden="true" /> Found at {item.locationFound}
                      </span>
                      <span className="item-meta-row">
                        <Calendar size={14} aria-hidden="true" /> {formatDate(item.dateFound)}
                      </span>
                    </div>
                    <Link to={`/found/${item.id}`} className="btn btn-secondary btn-sm" style={{ marginTop: 6 }}>
                      View details
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="page-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="two-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <div className="card card-compact">
              <Search size={24} color="#1d63dc" aria-hidden="true" />
              <h3 style={{ marginBottom: 6 }}>1. Report &amp; Match</h3>
              <p className="muted small" style={{ margin: 0 }}>
                File a lost or found report with location and date details. The system suggests possible
                matches to assist students and staff.
              </p>
            </div>
            <div className="card card-compact">
              <ShieldCheck size={24} color="#157347" aria-hidden="true" />
              <h3 style={{ marginBottom: 6 }}>2. Private Proof of Ownership</h3>
              <p className="muted small" style={{ margin: 0 }}>
                Distinguishing marks on found items are hidden from the public so claimants must supply
                accurate private details.
              </p>
            </div>
            <div className="card card-compact">
              <CheckCircle2 size={24} color="#92400e" aria-hidden="true" />
              <h3 style={{ marginBottom: 6 }}>3. Staff Verification &amp; Release</h3>
              <p className="muted small" style={{ margin: 0 }}>
                Authorized staff verify claims in person, record verification notes, update item statuses,
                and maintain an audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
