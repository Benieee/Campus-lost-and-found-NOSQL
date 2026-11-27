import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Package, PlusCircle, Search, SlidersHorizontal, X } from 'lucide-react';
import { foundItemsApi, locationsApi } from '../api/client';
import { ItemThumbnail, SkeletonCards } from '../components/ItemThumbnail';
import { Pagination } from '../components/Pagination';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  FOUND_STATUSES,
  ITEM_CATEGORIES,
  type CampusLocation,
  type FoundItem,
  type PaginationMeta
} from '../types';

export function FoundItemsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [items, setItems] = useState<FoundItem[]>([]);
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
      const res = await foundItemsApi.list({
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
      setError(err instanceof Error ? err.message : 'Unable to load found items.');
    } finally {
      setLoading(false);
    }
  }, [q, category, location, status, dateFrom, page]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const activeFilterCount = [category, location, status, dateFrom].filter(Boolean).length;

  const syncUrl = (overrides: Record<string, string> = {}) => {
    const merged = { q: q.trim(), category, location, status, dateFrom, ...overrides };
    const next = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    setSearchParams(next);
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    syncUrl();
  };

  const selectCategoryChip = (cat: string) => {
    setCategory(cat);
    setPage(1);
    syncUrl({ category: cat });
  };

  const resetFilters = () => {
    setQ('');
    setCategory('');
    setLocation('');
    setStatus('');
    setDateFrom('');
    setPage(1);
    setSearchParams({});
  };

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Found Items Directory</h1>
            <p>
              Browse items turned in across campus. Private identifying marks remain hidden until staff
              verify ownership.
            </p>
          </div>
          {user && (
            <Link to="/report-found" className="btn btn-primary btn-sm">
              <PlusCircle size={16} /> Report Found Item
            </Link>
          )}
        </div>

        <div className="chip-strip" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`chip ${category === '' ? 'active' : ''}`}
            onClick={() => selectCategoryChip('')}
          >
            All Categories
          </button>
          {ITEM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip ${category === cat ? 'active' : ''}`}
              onClick={() => selectCategoryChip(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <form onSubmit={applyFilters} className="filter-shell" aria-label="Filter found items">
          <div className="filter-top-row">
            <div className="filter-search-wrap">
              <Search size={16} aria-hidden="true" />
              <label htmlFor="found-q" className="sr-only">
                Search found items
              </label>
              <input
                id="found-q"
                type="search"
                placeholder="Search by item name, description, or location…"
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
              <label htmlFor="found-location">Campus location</label>
              <select
                id="found-location"
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
              <label htmlFor="found-status">Status</label>
              <select
                id="found-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Active statuses</option>
                {FOUND_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="found-date">Found since</label>
              <input
                id="found-date"
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
            <p style={{ marginTop: 0 }}>No found items match your current filters.</p>
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
                        <MapPin size={14} aria-hidden="true" /> Found: {item.locationFound}
                      </span>
                      <span className="item-meta-row">
                        <Package size={14} aria-hidden="true" /> Held: {item.holdingLocation}
                      </span>
                      <span className="item-meta-row">
                        <Calendar size={14} aria-hidden="true" /> {formatDate(item.dateFound)}
                      </span>
                    </div>
                    <div className="row-gap" style={{ marginTop: 8 }}>
                      <Link to={`/found/${item.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                        View Details
                      </Link>
                      {user && (item.status === 'Stored' || item.status === 'Claim Pending') && !item.isMine && (
                        <Link to={`/claims/new/${item.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                          Claim Item
                        </Link>
                      )}
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
