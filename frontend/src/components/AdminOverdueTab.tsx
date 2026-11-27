import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Clock, Scale, ShieldAlert } from 'lucide-react';
import { foundItemsApi, lostItemsApi } from '../api/client';
import { formatDate, StatusBadge } from './StatusBadge';
import {
  UNCLAIMED_POLICY_ACTIONS,
  type FoundItem,
  type LostItem,
  type UnclaimedPolicyAction
} from '../types';

interface AdminOverdueTabProps {
  policySummary: string;
  thresholds: { overdueLostDays: number; overdueFoundDays: number; unclaimedPolicyDays: number };
  overdueFound: FoundItem[];
  overdueLost: LostItem[];
  onActionSuccess: (msg: string) => void;
  onActionError: (msg: string) => void;
}

export function AdminOverdueTab({
  policySummary,
  thresholds,
  overdueFound,
  overdueLost,
  onActionSuccess,
  onActionError
}: AdminOverdueTabProps) {
  const [policyChoice, setPolicyChoice] = useState<Record<string, Exclude<UnclaimedPolicyAction, 'None'>>>({});
  const [policyNotes, setPolicyNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApplyPolicy = async (item: FoundItem) => {
    const action = policyChoice[item.id] || 'Transferred to University Store';
    const notes = (policyNotes[item.id] || '').trim();
    if (notes.length < 5) {
      onActionError('Please enter unclaimed-property policy notes (at least 5 characters).');
      return;
    }
    setBusyId(item.id);
    onActionError('');
    try {
      await foundItemsApi.applyUnclaimedPolicy(item.id, {
        policyAction: action,
        policyNotes: notes,
        archiveItem: action !== 'Extended Hold'
      });
      onActionSuccess(`Applied unclaimed-property policy "${action}" to "${item.itemName}".`);
    } catch (err) {
      onActionError(err instanceof Error ? err.message : 'Unable to apply unclaimed-property policy.');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveLost = async (item: LostItem) => {
    setBusyId(item.id);
    onActionError('');
    try {
      await lostItemsApi.update(item.id, { status: 'Closed', moderationStatus: 'Archived' });
      onActionSuccess(`Closed and archived overdue lost report "${item.itemName}".`);
    } catch (err) {
      onActionError(err instanceof Error ? err.message : 'Unable to archive overdue lost report.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="alert alert-warning small">
        <Scale size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>University Unclaimed Property Policy Monitor</strong>
          <div style={{ marginTop: 4 }}>{policySummary}</div>
        </div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="#b45309" /> Overdue Found Items in Storage (&ge; {thresholds.overdueFoundDays} days)
          </h2>
          <span className="badge badge-amber">{overdueFound.length} item(s)</span>
        </div>

        {overdueFound.length === 0 ? (
          <p className="muted small">No found items are currently past the {thresholds.overdueFoundDays}-day storage threshold.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {overdueFound.map((item) => (
              <div key={item.id} className="card card-compact" style={{ background: item.policyDue ? '#fef2f2' : '#fffbeb' }}>
                <div className="row-between" style={{ marginBottom: 8 }}>
                  <div>
                    <Link to={`/found/${item.id}`} style={{ fontWeight: 700, color: '#0e4d9c' }}>
                      {item.itemName}
                    </Link>{' '}
                    <span className="badge badge-slate">{item.category}</span>
                  </div>
                  <div className="row-gap">
                    <span className={`badge ${item.policyDue ? 'badge-red' : 'badge-amber'}`}>
                      <ShieldAlert size={12} /> {item.daysInStorage ?? 0} days in storage
                      {item.policyDue ? ` (Policy Due ≥ ${thresholds.unclaimedPolicyDays}d)` : ''}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                <div className="small muted" style={{ marginBottom: 10 }}>
                  Found {formatDate(item.dateFound)} at {item.locationFound} · Stored at{' '}
                  <strong>{item.holdingLocation}</strong>
                  {item.storageBin ? ` (${item.storageBin})` : ''}
                  {item.unclaimedPolicyAction && item.unclaimedPolicyAction !== 'None' && (
                    <> · Current policy: <strong>{item.unclaimedPolicyAction}</strong></>
                  )}
                </div>

                <div className="form-grid" style={{ marginBottom: 10 }}>
                  <div className="field">
                    <label htmlFor={`policy-action-${item.id}`}>University policy action</label>
                    <select
                      id={`policy-action-${item.id}`}
                      value={policyChoice[item.id] || 'Transferred to University Store'}
                      onChange={(e) =>
                        setPolicyChoice({
                          ...policyChoice,
                          [item.id]: e.target.value as Exclude<UnclaimedPolicyAction, 'None'>
                        })
                      }
                    >
                      {UNCLAIMED_POLICY_ACTIONS.map((act) => (
                        <option key={act} value={act}>
                          {act}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`policy-notes-${item.id}`}>Authorization / policy notes *</label>
                    <input
                      id={`policy-notes-${item.id}`}
                      value={policyNotes[item.id] || ''}
                      onChange={(e) => setPolicyNotes({ ...policyNotes, [item.id]: e.target.value })}
                      placeholder="e.g. Held >60 days without claim; approved for university store transfer"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyId === item.id}
                  onClick={() => void handleApplyPolicy(item)}
                >
                  <Scale size={14} /> {busyId === item.id ? 'Applying…' : 'Apply Unclaimed Policy & Log'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="#b91c1c" /> Unresolved Lost Reports (&ge; {thresholds.overdueLostDays} days)
          </h2>
          <span className="badge badge-red">{overdueLost.length} report(s)</span>
        </div>

        {overdueLost.length === 0 ? (
          <p className="muted small">No lost reports are past the {thresholds.overdueLostDays}-day unresolved window.</p>
        ) : (
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Lost Item</th>
                  <th>Owner</th>
                  <th>Days Open</th>
                  <th>Status</th>
                  <th>Policy Action</th>
                </tr>
              </thead>
              <tbody>
                {overdueLost.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Lost Item">
                      <Link to={`/lost/${item.id}`} style={{ fontWeight: 700, color: '#0e4d9c' }}>
                        {item.itemName}
                      </Link>
                      <div className="muted small">
                        {item.category} · Lost {formatDate(item.dateLost)} at {item.lastKnownLocation}
                      </div>
                    </td>
                    <td data-label="Owner" className="small">
                      <strong>{item.owner?.fullName || 'Unknown'}</strong>
                      <div className="muted">{item.owner?.email || item.owner?.studentId}</div>
                    </td>
                    <td data-label="Days Open">
                      <span className="badge badge-red">{item.daysOpen ?? 0} days</span>
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={item.status} />
                    </td>
                    <td data-label="Policy Action">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleArchiveLost(item)}
                      >
                        <Archive size={14} /> Close &amp; Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
