import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { adminApi, claimsApi, foundItemsApi, locationsApi, lostItemsApi } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination } from '../components/Pagination';
import { formatDate, formatDateTime, StatusBadge } from '../components/StatusBadge';
import {
  CLAIM_STATUSES,
  FOUND_STATUSES,
  LOST_STATUSES,
  type AdminMatchPair,
  type AuditLogEntry,
  type CampusLocation,
  type Claim,
  type ClaimStatus,
  type FoundItem,
  type FoundItemStatus,
  type LostItem,
  type LostItemStatus,
  type PaginationMeta,
  type User
} from '../types';

type AdminTab = 'overview' | 'claims' | 'lost' | 'found' | 'users' | 'locations' | 'audit';

interface PendingAction {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'primary' | 'danger' | 'success';
  run: () => Promise<void>;
}

export function AdminDashboardPage() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Overview state
  const [counts, setCounts] = useState({
    openLostReports: 0,
    foundItemsInStorage: 0,
    foundClaimPending: 0,
    claimsAwaitingReview: 0,
    recentlyReturnedItems: 0,
    totalReturnedItems: 0,
    totalStudents: 0,
    totalStaff: 0,
    activeLocations: 0
  });
  const [recentReturns, setRecentReturns] = useState<FoundItem[]>([]);
  const [awaitingClaims, setAwaitingClaims] = useState<Claim[]>([]);
  const [suggestedMatches, setSuggestedMatches] = useState<{ disclaimer: string; matches: AdminMatchPair[] } | null>(null);

  // Management lists
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsFilter, setClaimsFilter] = useState('');
  const [claimNotes, setClaimNotes] = useState<Record<string, string>>({});

  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState<PaginationMeta>({ page: 1, limit: 15, total: 0, totalPages: 1 });

  const [newLoc, setNewLoc] = useState({
    name: '',
    code: '',
    buildingArea: '',
    isHoldingDesk: false,
    description: ''
  });

  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const data = await adminApi.dashboard();
      setCounts(data.counts);
      setRecentReturns(data.recentReturns);
      setAwaitingClaims(data.awaitingClaims);
      setSuggestedMatches(data.suggestedMatches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load administration metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setError('');
    try {
      if (tab === 'overview') {
        await loadDashboard();
      } else if (tab === 'claims') {
        const res = await claimsApi.list({ status: claimsFilter || undefined, limit: 30 });
        setClaims(res.claims);
      } else if (tab === 'lost') {
        const res = await lostItemsApi.list({ limit: 30 });
        setLostItems(res.items);
      } else if (tab === 'found') {
        const res = await foundItemsApi.list({ limit: 30 });
        setFoundItems(res.items);
      } else if (tab === 'users') {
        const res = await adminApi.users({ limit: 50 });
        setUsers(res.users);
      } else if (tab === 'locations') {
        const res = await locationsApi.list({ includeInactive: true });
        setLocations(res.locations);
      } else if (tab === 'audit') {
        const res = await adminApi.auditLogs({ page: auditPage, limit: 15 });
        setAuditLogs(res.logs);
        setAuditPagination(res.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load management records.');
    }
  }, [tab, claimsFilter, auditPage, loadDashboard]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setError('');
    setSuccess('');
    try {
      await pendingAction.run();
      setPendingAction(null);
      await Promise.all([loadDashboard(), loadTabData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      setPendingAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  const requestClaimReview = (claim: Claim, nextStatus: ClaimStatus) => {
    const notes = (claimNotes[claim.id] ?? claim.verificationNotes ?? '').trim();
    if (notes.length < 3) {
      setError('Please enter verification notes (at least 3 characters) before updating a claim.');
      return;
    }

    setPendingAction({
      title: `Mark claim ${claim.referenceCode} as ${nextStatus}?`,
      message:
        nextStatus === 'Approved'
          ? 'Approving this claim will mark the related found item as Returned and reject any other pending claims for the same item.'
          : `This will update claim ${claim.referenceCode} to "${nextStatus}" and record your verification notes in the audit trail.`,
      confirmLabel: `Confirm ${nextStatus}`,
      tone: nextStatus === 'Approved' ? 'success' : nextStatus === 'Rejected' ? 'danger' : 'primary',
      run: async () => {
        await claimsApi.review(claim.id, { status: nextStatus, verificationNotes: notes });
        setSuccess(`Claim ${claim.referenceCode} updated to ${nextStatus}.`);
      }
    });
  };

  const requestLostStatusChange = (item: LostItem, nextStatus: LostItemStatus) => {
    if (item.status === nextStatus) return;
    setPendingAction({
      title: `Update lost report status?`,
      message: `Change "${item.itemName}" from ${item.status} to ${nextStatus}? This change will be recorded in the audit log.`,
      confirmLabel: 'Update status',
      tone: 'primary',
      run: async () => {
        await lostItemsApi.update(item.id, { status: nextStatus });
        setSuccess(`Lost report "${item.itemName}" marked ${nextStatus}.`);
      }
    });
  };

  const requestFoundStatusChange = (item: FoundItem, nextStatus: FoundItemStatus) => {
    if (item.status === nextStatus) return;
    setPendingAction({
      title: `Update found item status?`,
      message: `Change "${item.itemName}" from ${item.status} to ${nextStatus}?`,
      confirmLabel: 'Update status',
      tone: nextStatus === 'Archived' ? 'danger' : 'primary',
      run: async () => {
        await foundItemsApi.update(item.id, { status: nextStatus });
        setSuccess(`Found item "${item.itemName}" marked ${nextStatus}.`);
      }
    });
  };

  const requestUserChange = (target: User, patch: { role?: 'student' | 'admin'; isActive?: boolean }) => {
    const desc =
      patch.role !== undefined
        ? `Change ${target.fullName}'s role to ${patch.role}?`
        : `${patch.isActive ? 'Reactivate' : 'Deactivate'} ${target.fullName}'s account?`;
    setPendingAction({
      title: 'Confirm account update',
      message: desc,
      confirmLabel: 'Save account change',
      tone: patch.isActive === false ? 'danger' : 'primary',
      run: async () => {
        await adminApi.updateUser(target.id, patch);
        setSuccess(`Updated account for ${target.fullName}.`);
      }
    });
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await locationsApi.create({
        name: newLoc.name.trim(),
        code: newLoc.code.trim().toUpperCase(),
        buildingArea: newLoc.buildingArea.trim(),
        isHoldingDesk: newLoc.isHoldingDesk,
        description: newLoc.description.trim()
      });
      setNewLoc({ name: '', code: '', buildingArea: '', isHoldingDesk: false, description: '' });
      setSuccess('Campus location added.');
      await Promise.all([loadDashboard(), loadTabData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add campus location.');
    }
  };

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-header">
          <div>
            <span className="badge badge-green">
              <ShieldCheck size={13} /> Authorized Staff Workspace
            </span>
            <h1 style={{ marginTop: 8 }}>Staff Administration Dashboard</h1>
            <p>Review ownership claims, manage campus inventory, locations, users, and audit logs.</p>
          </div>
          <Link to="/report-found" className="btn btn-primary btn-sm">
            Log New Found Item
          </Link>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Open Lost Reports</div>
            <div className="kpi-value">{counts.openLostReports}</div>
            <div className="kpi-sub">Missing or Matched</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Found Items in Storage</div>
            <div className="kpi-value">{counts.foundItemsInStorage}</div>
            <div className="kpi-sub">{counts.foundClaimPending} claim pending</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Claims Awaiting Review</div>
            <div className="kpi-value">{counts.claimsAwaitingReview}</div>
            <div className="kpi-sub">Pending or Under Review</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Recently Returned Items</div>
            <div className="kpi-value">{counts.recentlyReturnedItems}</div>
            <div className="kpi-sub">{counts.totalReturnedItems} returned overall</div>
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
          {(
            [
              ['overview', 'Overview & Matches'],
              ['claims', `Claims (${counts.claimsAwaitingReview} open)`],
              ['lost', 'Lost Reports'],
              ['found', 'Found Inventory'],
              ['users', `Users (${counts.totalStudents + counts.totalStaff})`],
              ['locations', `Locations (${counts.activeLocations})`],
              ['audit', 'Audit Trail']
            ] as [AdminTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab-btn ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && tab === 'overview' ? (
          <div className="loading-state" role="status">
            Loading dashboard data…
          </div>
        ) : tab === 'overview' ? (
          <div style={{ display: 'grid', gap: 20 }}>
            <div className="two-col">
              <div className="card">
                <div className="row-between" style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Claims Awaiting Review</h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('claims')}>
                    Review Queue
                  </button>
                </div>
                {awaitingClaims.length === 0 ? (
                  <p className="muted small">All ownership claims have been processed.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {awaitingClaims.map((claim) => (
                      <div key={claim.id} className="card card-compact">
                        <div className="row-between">
                          <strong>
                            {claim.referenceCode} — {claim.foundItem?.itemName}
                          </strong>
                          <StatusBadge status={claim.status} />
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Claimant: {claim.claimant?.fullName} ({claim.claimant?.studentId}) ·{' '}
                          {formatDate(claim.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.1rem' }}>Recently Returned Items</h2>
                {recentReturns.length === 0 ? (
                  <p className="muted small">No returned items recorded yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recentReturns.map((item) => (
                      <div key={item.id} className="card card-compact">
                        <div className="row-between">
                          <strong>{item.itemName}</strong>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          {item.category} · Returned {formatDate(item.updatedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="row-gap" style={{ marginBottom: 10 }}>
                <Sparkles size={18} color="#1d63dc" />
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Suggested Lost / Found Matches</h2>
              </div>
              {suggestedMatches && (
                <div className="alert alert-warning small">{suggestedMatches.disclaimer}</div>
              )}
              {!suggestedMatches || suggestedMatches.matches.length === 0 ? (
                <p className="muted small">No high-confidence cross-matches currently detected.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Lost Report</th>
                        <th>Found Item</th>
                        <th>Match Score</th>
                        <th>Match Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestedMatches.matches.map((pair, idx) => (
                        <tr key={`${pair.lostItem.id}-${pair.foundItem.id}-${idx}`}>
                          <td>
                            <Link to={`/lost/${pair.lostItem.id}`} style={{ fontWeight: 600, color: '#1d63dc' }}>
                              {pair.lostItem.itemName}
                            </Link>
                            <div className="muted small">{pair.lostItem.lastKnownLocation}</div>
                          </td>
                          <td>
                            <Link to={`/found/${pair.foundItem.id}`} style={{ fontWeight: 600, color: '#1d63dc' }}>
                              {pair.foundItem.itemName}
                            </Link>
                            <div className="muted small">{pair.foundItem.holdingLocation}</div>
                          </td>
                          <td>
                            <span className="badge badge-purple">{pair.score}%</span>
                          </td>
                          <td className="small">{pair.reasons.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'claims' ? (
          <div>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div className="field" style={{ maxWidth: 240 }}>
                <label htmlFor="admin-claim-filter">Filter by claim status</label>
                <select
                  id="admin-claim-filter"
                  value={claimsFilter}
                  onChange={(e) => setClaimsFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {CLAIM_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {claims.length === 0 ? (
              <div className="empty-state">No ownership claims match this filter.</div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {claims.map((claim) => (
                  <div key={claim.id} className="card">
                    <div className="row-between" style={{ marginBottom: 12 }}>
                      <div>
                        <span className="badge badge-slate">{claim.referenceCode}</span>{' '}
                        <strong style={{ marginLeft: 8, fontSize: '1.05rem' }}>
                          {claim.foundItem?.itemName || 'Found Item'}
                        </strong>
                      </div>
                      <StatusBadge status={claim.status} />
                    </div>

                    <div className="two-col" style={{ marginBottom: 14 }}>
                      <div className="card card-compact" style={{ background: '#f8fafc' }}>
                        <div className="muted small">
                          <strong>Claimant Submission</strong>
                        </div>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Student:</strong> {claim.claimant?.fullName} ({claim.claimant?.studentId}) ·{' '}
                          {claim.claimant?.email} · {claim.claimant?.phone}
                        </p>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Explanation:</strong> {claim.explanation}
                        </p>
                        <p className="small" style={{ margin: '6px 0 0' }}>
                          <strong>Ownership Proof:</strong> {claim.identifyingProof}
                        </p>
                      </div>

                      <div className="card card-compact" style={{ background: '#fefce8' }}>
                        <div className="muted small">
                          <strong>Stored Found Item (Staff-Only Intake Record)</strong>
                        </div>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Holding Location:</strong> {claim.foundItem?.holdingLocation} (Status:{' '}
                          {claim.foundItem?.status})
                        </p>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Public Summary:</strong> {claim.foundItem?.description}
                        </p>
                        <p className="small" style={{ margin: '6px 0 0' }}>
                          <strong>Private Identifying Details:</strong>{' '}
                          {claim.foundItem?.identifyingDetails || 'Not recorded'}
                        </p>
                      </div>
                    </div>

                    {claim.reviewedBy && (
                      <p className="muted small" style={{ marginBottom: 10 }}>
                        Last reviewed by <strong>{claim.reviewedBy.fullName}</strong> on{' '}
                        {formatDateTime(claim.reviewedAt)}
                      </p>
                    )}

                    <div className="field" style={{ marginBottom: 12 }}>
                      <label htmlFor={`notes-${claim.id}`}>Staff verification notes *</label>
                      <textarea
                        id={`notes-${claim.id}`}
                        style={{ minHeight: 70 }}
                        value={claimNotes[claim.id] ?? claim.verificationNotes ?? ''}
                        onChange={(e) => setClaimNotes({ ...claimNotes, [claim.id]: e.target.value })}
                        placeholder="Record ID check outcome, matching marks confirmed, or reason for rejection"
                      />
                    </div>

                    <div className="row-gap">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => requestClaimReview(claim, 'Under Review')}
                      >
                        Mark Under Review
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => requestClaimReview(claim, 'Approved')}
                        disabled={claim.status === 'Approved'}
                      >
                        Approve &amp; Mark Returned
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => requestClaimReview(claim, 'Rejected')}
                        disabled={claim.status === 'Rejected'}
                      >
                        Reject Claim
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'lost' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item &amp; Private Notes</th>
                  <th>Owner</th>
                  <th>Location / Date</th>
                  <th>Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {lostItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/lost/${item.id}`} style={{ fontWeight: 600, color: '#1d63dc' }}>
                        {item.itemName}
                      </Link>
                      <div className="muted small">{item.category}</div>
                      {item.identifyingDetails && (
                        <div className="small" style={{ marginTop: 4 }}>
                          <em>Private:</em> {item.identifyingDetails}
                        </div>
                      )}
                    </td>
                    <td className="small">
                      {item.owner?.fullName}
                      <div className="muted">{item.owner?.studentId}</div>
                    </td>
                    <td className="small">
                      {item.lastKnownLocation}
                      <div className="muted">{formatDate(item.dateLost)}</div>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <select
                        aria-label={`Change status for ${item.itemName}`}
                        value={item.status}
                        onChange={(e) => requestLostStatusChange(item, e.target.value as LostItemStatus)}
                      >
                        {LOST_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'found' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item &amp; Private Verification Marks</th>
                  <th>Found At / Holding Desk</th>
                  <th>Date Found</th>
                  <th>Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {foundItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/found/${item.id}`} style={{ fontWeight: 600, color: '#1d63dc' }}>
                        {item.itemName}
                      </Link>
                      <div className="muted small">{item.category}</div>
                      {item.identifyingDetails && (
                        <div className="small" style={{ marginTop: 4 }}>
                          <em>Private:</em> {item.identifyingDetails}
                        </div>
                      )}
                    </td>
                    <td className="small">
                      {item.locationFound}
                      <div className="muted">Held: {item.holdingLocation}</div>
                    </td>
                    <td className="small">{formatDate(item.dateFound)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <select
                        aria-label={`Change status for ${item.itemName}`}
                        value={item.status}
                        onChange={(e) => requestFoundStatusChange(item, e.target.value as FoundItemStatus)}
                      >
                        {FOUND_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'users' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name &amp; Email</th>
                  <th>Student / Staff ID</th>
                  <th>Course / Dept</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.fullName}</strong>
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td className="small">{u.studentId}</td>
                    <td className="small">{u.course}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="row-gap">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            requestUserChange(u, { role: u.role === 'admin' ? 'student' : 'admin' })
                          }
                        >
                          Make {u.role === 'admin' ? 'Student' : 'Staff'}
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => requestUserChange(u, { isActive: !u.isActive })}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'locations' ? (
          <div className="two-col">
            <div className="card">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Add Campus Location</h2>
              <form onSubmit={handleCreateLocation} style={{ display: 'grid', gap: 12 }}>
                <div className="field">
                  <label htmlFor="loc-name">Location name *</label>
                  <input
                    id="loc-name"
                    required
                    value={newLoc.name}
                    onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                    placeholder="e.g. Sports Pavilion Desk"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc-code">Short code *</label>
                  <input
                    id="loc-code"
                    required
                    value={newLoc.code}
                    onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                    placeholder="e.g. SPT-01"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc-area">Campus area / zone *</label>
                  <input
                    id="loc-area"
                    required
                    value={newLoc.buildingArea}
                    onChange={(e) => setNewLoc({ ...newLoc, buildingArea: e.target.value })}
                    placeholder="e.g. South Campus"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc-desc">Description</label>
                  <input
                    id="loc-desc"
                    value={newLoc.description}
                    onChange={(e) => setNewLoc({ ...newLoc, description: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={newLoc.isHoldingDesk}
                    onChange={(e) => setNewLoc({ ...newLoc, isHoldingDesk: e.target.checked })}
                  />
                  Authorized holding desk for storing found items
                </label>
                <button type="submit" className="btn btn-primary">
                  Add Location
                </button>
              </form>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Holding Desk</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id}>
                      <td>
                        <strong>{loc.name}</strong> ({loc.code})
                        <div className="muted small">{loc.buildingArea}</div>
                      </td>
                      <td>
                        <span className={`badge ${loc.isHoldingDesk ? 'badge-blue' : 'badge-slate'}`}>
                          {loc.isHoldingDesk ? 'Holding Desk' : 'Area Only'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${loc.isActive ? 'badge-green' : 'badge-red'}`}>
                          {loc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setPendingAction({
                              title: `${loc.isActive ? 'Deactivate' : 'Activate'} location?`,
                              message: `${loc.isActive ? 'Hide' : 'Restore'} "${loc.name}" in campus location selectors?`,
                              confirmLabel: 'Confirm',
                              tone: loc.isActive ? 'danger' : 'success',
                              run: async () => {
                                await locationsApi.update(loc.id, { isActive: !loc.isActive });
                                setSuccess(`Updated location "${loc.name}".`);
                              }
                            })
                          }
                        >
                          {loc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="small">{formatDateTime(log.createdAt)}</td>
                      <td className="small">
                        {log.actor?.fullName || 'System'}
                        <div className="muted">{log.actorRole}</div>
                      </td>
                      <td>
                        <span className="badge badge-slate">{log.action}</span>
                      </td>
                      <td className="small">{log.entityType}</td>
                      <td className="small">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={auditPagination} onPageChange={setAuditPage} />
          </div>
        )}

        <ConfirmDialog
          open={Boolean(pendingAction)}
          title={pendingAction?.title || ''}
          message={pendingAction?.message || ''}
          confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
          tone={pendingAction?.tone || 'primary'}
          busy={actionBusy}
          onConfirm={executeConfirmedAction}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    </section>
  );
}
