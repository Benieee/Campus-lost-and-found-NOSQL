import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  PlusCircle,
  Search,
  ShieldCheck
} from 'lucide-react';
import { foundItemsApi, publicApi } from '../api/client';
import { ItemThumbnail, SkeletonCards } from '../components/ItemThumbnail';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { ITEM_CATEGORIES, type FoundItem } from '../types';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState<{
    openLostReports: number;
    foundInStorage: number;
    returnedItems: number;
  } | null>(null);
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
            <span className="badge badge-blue">Bugema University Campus Portal</span>
            <h1>Reunite with lost campus property, faster and safer.</h1>
            <p>
              Report missing items, browse found belongings turned in across campus, and submit
              verified ownership claims — with private identifying details protected from public view.
            </p>
            <div className="hero-actions">
              {user ? (
                <>
                  <Link to="/report-lost" className="btn btn-primary">
                    <PlusCircle size={17} /> I Lost Something
                  </Link>
                  <Link to="/report-found" className="btn btn-ghost-light">
                    <Package size={17} /> I Found Something
                  </Link>
                  <Link to="/found" className="btn btn-ghost-light">
                    Browse Found <ArrowRight size={16} />
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
                    Browse Found <ArrowRight size={16} />
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="hero-panel">
            <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: '1.15rem' }}>
              Quick search found items
            </h2>
            <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.85 }}>
              Search by item name, category, or campus building.
            </p>
            <form onSubmit={handleSearch} className="search-inline" role="search">
              <label htmlFor="hero-search" className="sr-only">
                Search found items
              </label>
              <input
                id="hero-search"
                type="search"
                placeholder="e.g. calculator, charger, keys, library…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Search size={16} /> Search
              </button>
            </form>

            {summary && (
              <div className="hero-stats">
                <div className="hero-stat-box">
                  <div className="hero-stat-value">{summary.openLostReports}</div>
                  <div className="hero-stat-label">Open Lost</div>
                </div>
                <div className="hero-stat-box">
                  <div className="hero-stat-value">{summary.foundInStorage}</div>
                  <div className="hero-stat-label">Found Held</div>
                </div>
                <div className="hero-stat-box">
                  <div className="hero-stat-value">{summary.returnedItems}</div>
                  <div className="hero-stat-label">Returned</div>
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
              <h2 style={{ margin: '0 0 4px', fontSize: 'clamp(1.3rem, 2.2vw, 1.7rem)' }}>
                Recently Logged Found Property
              </h2>
              <p className="muted">
                Tap a category to filter or click any item to view holding details and submit a claim.
              </p>
            </div>
            <Link to="/found" className="btn btn-secondary btn-sm">
              View all found items <ArrowRight size={15} />
            </Link>
          </div>

          <div className="chip-strip" aria-label="Browse found items by category">
            <Link to="/found" className="chip active">
              All Categories
            </Link>
            {ITEM_CATEGORIES.slice(0, 7).map((cat) => (
              <Link key={cat} to={`/found?category=${encodeURIComponent(cat)}`} className="chip">
                {cat}
              </Link>
            ))}
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <SkeletonCards count={3} />
          ) : recentFound.length === 0 ? (
            <div className="empty-state">
              <p style={{ marginTop: 0 }}>No found items are currently listed.</p>
              {user && (
                <Link to="/report-found" className="btn btn-primary btn-sm">
                  Log a found item
                </Link>
              )}
            </div>
          ) : (
            <div className="items-grid">
              {recentFound.map((item) => (
                <article key={item.id} className="item-card">
                  <ItemThumbnail
                    imageUrl={item.imageUrl}
                    itemName={item.itemName}
                    category={item.category}
                  />
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
                        <Package size={14} aria-hidden="true" /> Held at {item.holdingLocation}
                      </span>
                      <span className="item-meta-row">
                        <Calendar size={14} aria-hidden="true" /> {formatDate(item.dateFound)}
                      </span>
                    </div>
                    <div className="row-gap" style={{ marginTop: 8 }}>
                      <Link
                        to={`/found/${item.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                      >
                        View Details
                      </Link>
                      {user &&
                        (item.status === 'Stored' || item.status === 'Claim Pending') &&
                        !item.isMine && (
                          <Link
                            to={`/claims/new/${item.id}`}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                          >
                            Claim Item
                          </Link>
                        )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="page-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="steps-grid">
            <div className="card card-compact">
              <Search size={24} color="#1d63dc" aria-hidden="true" />
              <h3 style={{ margin: '10px 0 6px' }}>1. Report &amp; Match</h3>
              <p className="muted small" style={{ margin: 0 }}>
                File a lost or found report with location and date details. The system suggests possible
                matches to assist students and staff.
              </p>
            </div>
            <div className="card card-compact">
              <ShieldCheck size={24} color="#157347" aria-hidden="true" />
              <h3 style={{ margin: '10px 0 6px' }}>2. Private Proof of Ownership</h3>
              <p className="muted small" style={{ margin: 0 }}>
                Distinguishing marks on found items are hidden from the public so claimants must supply
                accurate private details.
              </p>
            </div>
            <div className="card card-compact">
              <CheckCircle2 size={24} color="#92400e" aria-hidden="true" />
              <h3 style={{ margin: '10px 0 6px' }}>3. Staff Verification &amp; Release</h3>
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
