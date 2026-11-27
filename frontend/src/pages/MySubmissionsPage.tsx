import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { claimsApi, foundItemsApi, lostItemsApi } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, formatDateTime, StatusBadge } from '../components/StatusBadge';
import type { Claim, FoundItem, LostItem } from '../types';

type TabKey = 'lost' | 'found' | 'claims';

export function MySubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'lost';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState<LostItem | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lostRes, foundRes, claimsRes] = await Promise.all([
        lostItemsApi.list({ mine: true, limit: 50 }),
        foundItemsApi.list({ mine: true, limit: 50 }),
        claimsApi.list({ limit: 50 })
      ]);
      setLostItems(lostRes.items);
      setFoundItems(foundRes.items);
      setClaims(claimsRes.claims);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const switchTab = (next: TabKey) => {
    setTab(next);
    setSearchParams({ tab: next });
  };

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await lostItemsApi.update(withdrawTarget.id, { status: 'Closed' });
      setSuccess(`Report "${withdrawTarget.itemName}" has been withdrawn and marked Closed.`);
      setWithdrawTarget(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>My Submissions &amp; Claims</h1>
            <p>Track your lost-item reports, found-item logs, and ownership verification claims.</p>
          </div>
          <div className="row-gap">
            <Link to="/report-lost" className="btn btn-primary btn-sm">
              Report Lost
            </Link>
            <Link to="/report-found" className="btn btn-secondary btn-sm">
              Report Found
            </Link>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        )}

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'lost'}
            className={`tab-btn ${tab === 'lost' ? 'active' : ''}`}
            onClick={() => switchTab('lost')}
          >
            My Lost Reports ({lostItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'found'}
            className={`tab-btn ${tab === 'found' ? 'active' : ''}`}
            onClick={() => switchTab('found')}
          >
            My Found Reports ({foundItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'claims'}
            className={`tab-btn ${tab === 'claims' ? 'active' : ''}`}
            onClick={() => switchTab('claims')}
          >
            My Claims ({claims.length})
          </button>
        </div>

        {loading ? (
          <div className="loading-state" role="status">
            Loading your records…
          </div>
        ) : tab === 'lost' ? (
          lostItems.length === 0 ? (
            <div className="empty-state">
              <p>You haven’t submitted any lost-item reports yet.</p>
              <Link to="/report-lost" className="btn btn-primary btn-sm">
                Report a lost item
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Last-Known Location</th>
                    <th>Date Lost</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lostItems.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item">
                        <Link to={`/lost/${item.id}`} style={{ fontWeight: 600, color: '#1d63dc' }}>
                          {item.itemName}
                        </Link>
                      </td>
                      <td data-label="Category">{item.category}</td>
                      <td data-label="Last-Known Location">{item.lastKnownLocation}</td>
                      <td data-label="Date Lost">{formatDate(item.dateLost)}</td>
                      <td data-label="Status">
                        <StatusBadge status={item.status} />
                      </td>
                      <td data-label="Actions">
                        <div className="row-gap">
                          <Link to={`/lost/${item.id}`} className="btn btn-secondary btn-sm">
                            Matches
                          </Link>
                          {(item.status === 'Missing' || item.status === 'Matched') && (
                            <>
                              <Link to={`/report-lost?edit=${item.id}`} className="btn btn-secondary btn-sm">
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setWithdrawTarget(item)}
                              >
                                Withdraw
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'found' ? (
          foundItems.length === 0 ? (
            <div className="empty-state">
              <p>You haven’t logged any found items yet.</p>
              <Link to="/report-found" className="btn btn-primary btn-sm">
                Report a found item
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Location Found</th>
                    <th>Holding Desk</th>
                    <th>Date Found</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {foundItems.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item">
                        <Link to={`/found/${item.id}`} style={{ fontWeight: 600, color: '#1d63dc' }}>
                          {item.itemName}
                        </Link>
                      </td>
                      <td data-label="Category">{item.category}</td>
                      <td data-label="Location Found">{item.locationFound}</td>
                      <td data-label="Holding Desk">{item.holdingLocation}</td>
                      <td data-label="Date Found">{formatDate(item.dateFound)}</td>
                      <td data-label="Status">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : claims.length === 0 ? (
          <div className="empty-state">
            <p>You haven’t submitted any ownership claims yet.</p>
            <Link to="/found" className="btn btn-primary btn-sm">
              Browse found items
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {claims.map((claim) => (
              <div key={claim.id} className="card card-compact">
                <div className="row-between">
                  <div>
                    <span className="badge badge-slate">{claim.referenceCode}</span>{' '}
                    <strong style={{ marginLeft: 6 }}>
                      {claim.foundItem?.itemName || 'Found Item'}
                    </strong>
                  </div>
                  <StatusBadge status={claim.status} />
                </div>
                <p className="small" style={{ margin: '10px 0 6px' }}>
                  <strong>Your explanation:</strong> {claim.explanation}
                </p>
                <p className="small muted" style={{ margin: '0 0 8px' }}>
                  <strong>Submitted proof:</strong> {claim.identifyingProof}
                </p>
                <div className="small muted">
                  Submitted {formatDateTime(claim.createdAt)}
                  {claim.foundItem?.holdingLocation ? ` · Held at ${claim.foundItem.holdingLocation}` : ''}
                </div>
                {claim.verificationNotes && (
                  <div className="alert alert-info small" style={{ marginTop: 10, marginBottom: 0 }}>
                    <div>
                      <strong>Staff Review Outcome:</strong> {claim.verificationNotes}
                      {claim.reviewedBy && (
                        <div className="muted" style={{ marginTop: 4 }}>
                          Reviewed by {claim.reviewedBy.fullName} on {formatDateTime(claim.reviewedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={Boolean(withdrawTarget)}
          title="Withdraw lost-item report?"
          message={`Are you sure you want to withdraw "${withdrawTarget?.itemName}"? Its status will change to Closed.`}
          confirmLabel="Withdraw report"
          tone="danger"
          busy={busy}
          onConfirm={confirmWithdraw}
          onCancel={() => setWithdrawTarget(null)}
        />
      </div>
    </section>
  );
}
