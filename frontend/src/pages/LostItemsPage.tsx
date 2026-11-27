import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, PlusCircle, Search, SlidersHorizontal, X } from 'lucide-react';
import { locationsApi, lostItemsApi } from '../api/client';
import { ItemThumbnail, SkeletonCards } from '../components/ItemThumbnail';
import { Pagination } from '../components/Pagination';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  ITEM_CATEGORIES,
  LOST_STATUSES,
  type CampusLocation,
  type LostItem,
  type PaginationMeta
} from '../types';

export function LostItemsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [items, setItems] = useState<LostItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 9, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    locationsApi.list().then((res) => setLocations(res.locations)).catch(() => {});
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await lostItemsApi.list({
        q: q.trim() || undefined,
        category: category || undefined,
        location: location || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        page,
        limit: 9
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load lost-item reports.');
    } finally {
      setLoading(false);
    }
  }, [q, category, location, status, dateFrom, page]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const activeFilterCount = [category, location, status, dateFrom].filter(Boolean).length;

  const resetFilters = () => {
    setQ('');
    setCategory('');
    setLocation('');
    setStatus('');
    setDateFrom('');
    setPage(1);
  };

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Lost-Item Reports</h1>
            <p>
              Public summaries of reported missing items. Found something listed here? Turn it in at a
              holding desk and log a found report.
            </p>
          </div>
          {user && (
            <Link to="/report-lost" className="btn btn-primary btn-sm">
              <PlusCircle size={16} /> Report Lost Item
            </Link>
          )}
        </div>

        <div className="chip-strip" role="group" aria-label="Filter lost reports by category">
          <button
            type="button"
            className={`chip ${category === '' ? 'active' : ''}`}
            onClick={() => {
              setCategory('');
              setPage(1);
            }}
          >
            All Categories
          </button>
          {ITEM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip ${category === cat ? 'active' : ''}`}
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="filter-shell"
          aria-label="Filter lost items"
        >
          <div className="filter-top-row">
            <div className="filter-search-wrap">
              <Search size={16} aria-hidden="true" />
              <label htmlFor="lost-q" className="sr-only">
                Search lost reports
              </label>
              <input
                id="lost-q"
                type="search"
                placeholder="Search by item name, description, or campus building…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm filter-toggle-mobile"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={15} />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            {(q || activeFilterCount > 0) && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                <X size={15} /> Clear
              </button>
            )}
          </div>

          <div className={`filter-bar ${filtersOpen ? '' : 'collapsed-mobile'}`}>
            <div className="field">
              <label htmlFor="lost-location">Last-known location</label>
              <select
                id="lost-location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="lost-status">Status</label>
              <select
                id="lost-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {LOST_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="lost-date">Lost since</label>
              <input
                id="lost-date"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="field">
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Search size={15} /> Apply Filters
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonCards count={6} />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p style={{ marginTop: 0 }}>No lost-item reports match your filters.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
              Reset all filters
            </button>
          </div>
        ) : (
          <>
            <div className="items-grid">
              {items.map((item) => (
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
                    <h2 className="item-card-title">{item.itemName}</h2>
                    <p className="item-card-desc">{item.description}</p>
                    <div className="item-meta">
                      <span className="item-meta-row">
                        <MapPin size={14} aria-hidden="true" /> Last seen: {item.lastKnownLocation}
                      </span>
                      <span className="item-meta-row">
                        <Calendar size={14} aria-hidden="true" /> {formatDate(item.dateLost)} ({item.approximateTimeLost})
                      </span>
                    </div>
                    <div className="row-gap" style={{ marginTop: 8 }}>
                      <Link to={`/lost/${item.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                        View Details &amp; Matches
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </section>
  );
}
