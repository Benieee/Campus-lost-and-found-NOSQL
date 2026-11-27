import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Lock,
  MapPin,
  Package,
  Pencil,
  Sparkles,
  Trash2
} from 'lucide-react';
import { ApiError, foundItemsApi, locationsApi, lostItemsApi, resolveMediaUrl } from '../api/client';
import { AdminItemModal } from '../components/AdminItemModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { CampusLocation, FoundItem, LostItem, SuggestedMatchesResponse } from '../types';

export function ItemDetailPage({ kind }: { kind: 'lost' | 'found' }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lostItem, setLostItem] = useState<LostItem | null>(null);
  const [foundItem, setFoundItem] = useState<FoundItem | null>(null);
  const [lostMatches, setLostMatches] = useState<SuggestedMatchesResponse<FoundItem> | null>(null);
  const [foundMatches, setFoundMatches] = useState<SuggestedMatchesResponse<LostItem> | null>(null);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'primary' | 'danger' | 'success';
    run: () => Promise<void>;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      if (kind === 'lost') {
        const res = await lostItemsApi.getById(id);
        setLostItem(res.item);
        setLostMatches(res.suggestedMatches);
      } else {
        const res = await foundItemsApi.getById(id);
        setFoundItem(res.item);
        setFoundMatches(res.suggestedMatches);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to load ${kind} item.`);
    } finally {
      setLoading(false);
    }
  }, [id, kind]);

  useEffect(() => {
    void loadItem();
    if (user?.role === 'admin') {
      locationsApi.list({ includeInactive: true }).then((r) => setLocations(r.locations)).catch(() => {});
    }
  }, [loadItem, user?.role]);

  const executeConfirm = async () => {
    if (!confirmState) return;
    setActionBusy(true);
    setError('');
    try {
      await confirmState.run();
      setConfirmState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      setConfirmState(null);
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="page-section">
        <div className="container">
          <div className="loading-state" role="status">
            Loading item details…
          </div>
        </div>
      </section>
    );
  }

  if (error && (kind === 'lost' ? !lostItem : !foundItem)) {
    return (
      <section className="page-section">
        <div className="container">
          <div className="alert alert-error" role="alert">
            {error}
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go back
          </button>
        </div>
      </section>
    );
  }

  const isFound = kind === 'found';
  const item = isFound ? foundItem! : lostItem!;
  const isAdmin = user?.role === 'admin';
  const canClaimFound =
    isFound &&
    (foundItem!.status === 'Stored' || foundItem!.status === 'Claim Pending') &&
    !foundItem!.isMine;

  const requestAdminMarkRecovered = () => {
    setConfirmState({
      open: true,
      title: isFound ? 'Mark item returned to owner?' : 'Mark lost item as found by owner?',
      message: isFound
        ? `Update "${item.itemName}" to Returned?`
        : `Update "${item.itemName}" to Claimed (recovered by owner)?`,
      confirmLabel: isFound ? 'Mark Returned' : 'Mark Found by Owner',
      tone: 'success',
      run: async () => {
        if (isFound) {
          const res = await foundItemsApi.update(item.id, { status: 'Returned' });
          setFoundItem(res.item);
          setSuccess('Item marked as Returned to owner.');
        } else {
          const res = await lostItemsApi.update(item.id, { status: 'Claimed' });
          setLostItem(res.item);
          setSuccess('Lost report marked as Claimed (found by owner).');
        }
      }
    });
  };

  const requestAdminDelete = () => {
    setConfirmState({
      open: true,
      title: `Delete ${isFound ? 'found item' : 'lost report'}?`,
      message: `Permanently remove "${item.itemName}" from the system? This action is recorded in the audit log and cannot be undone.`,
      confirmLabel: 'Delete Item',
      tone: 'danger',
      run: async () => {
        if (isFound) {
          try {
            await foundItemsApi.remove(item.id, false);
            navigate('/admin', { replace: true });
          } catch (err) {
            if (err instanceof ApiError && err.code === 'ACTIVE_CLAIMS_EXIST') {
              await foundItemsApi.remove(item.id, true);
              navigate('/admin', { replace: true });
              return;
            }
            throw err;
          }
        } else {
          await lostItemsApi.remove(item.id);
          navigate('/admin', { replace: true });
        }
      }
    });
  };

  const requestOwnerWithdraw = () => {
    if (!lostItem) return;
    setConfirmState({
      open: true,
      title: 'Withdraw lost-item report?',
      message: 'Withdrawing marks this report as Closed. You can still view it in your submission history.',
      confirmLabel: 'Yes, withdraw report',
      tone: 'danger',
      run: async () => {
        const res = await lostItemsApi.update(lostItem.id, { status: 'Closed' });
        setLostItem(res.item);
        setSuccess('Your lost report has been withdrawn.');
      }
    });
  };

  return (
    <section className="page-section">
      <div className="container">
        <div style={{ marginBottom: 16 }}>
          <Link to={isFound ? '/found' : '/lost'} className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} /> Back to {isFound ? 'Found Items' : 'Lost Reports'}
          </Link>
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

        <div className="detail-layout">
          <div className="card">
            {item.imageUrl && (
              <div
                style={{
                  marginBottom: 18,
                  borderRadius: 12,
                  overflow: 'hidden',
                  maxHeight: 340,
                  background: '#f1f5f9'
                }}
              >
                <img
                  src={resolveMediaUrl(item.imageUrl)}
                  alt={item.itemName}
                  style={{ width: '100%', maxHeight: 340, objectFit: 'contain' }}
                />
              </div>
            )}

            <div className="row-between" style={{ marginBottom: 12 }}>
              <span className="badge badge-blue">{item.category}</span>
              <StatusBadge status={item.status} />
            </div>

            <h1 style={{ marginTop: 0, marginBottom: 10 }}>{item.itemName}</h1>
            <p style={{ marginTop: 0 }}>{item.description}</p>

            <div className="form-grid" style={{ marginTop: 20 }}>
              <div className="card card-compact">
                <div className="muted small">
                  <MapPin size={14} style={{ verticalAlign: 'middle' }} />{' '}
                  {isFound ? 'Location Found' : 'Last-Known Location'}
                </div>
                <strong>{isFound ? foundItem!.locationFound : lostItem!.lastKnownLocation}</strong>
              </div>

              <div className="card card-compact">
                <div className="muted small">
                  <Calendar size={14} style={{ verticalAlign: 'middle' }} />{' '}
                  {isFound ? 'Date Found' : 'Date & Approximate Time Lost'}
                </div>
                <strong>
                  {isFound
                    ? formatDate(foundItem!.dateFound)
                    : `${formatDate(lostItem!.dateLost)} (${lostItem!.approximateTimeLost})`}
                </strong>
              </div>

              {isFound && (
                <div className="card card-compact form-full">
                  <div className="muted small">
                    <Package size={14} style={{ verticalAlign: 'middle' }} /> Current Holding Location
                  </div>
                  <strong>{foundItem!.holdingLocation}</strong>
                </div>
              )}

              {item.identifyingDetails ? (
                <div className="card card-compact form-full" style={{ background: '#f8fafc' }}>
                  <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={14} /> Private Identifying Details (Visible only to owner/reporter &amp; authorized staff)
                  </div>
                  <p style={{ margin: '6px 0 0' }}>{item.identifyingDetails}</p>
                </div>
              ) : (
                <div className="alert alert-info form-full" style={{ marginBottom: 0 }}>
                  <Lock size={18} style={{ flexShrink: 0 }} />
                  <span className="small">
                    Sensitive identifying details are hidden from public view to prevent fraudulent
                    ownership claims.
                  </span>
                </div>
              )}
            </div>

            <div className="row-gap" style={{ marginTop: 22 }}>
              {canClaimFound &&
                (user ? (
                  <Link to={`/claims/new/${foundItem!.id}`} className="btn btn-primary">
                    Submit Ownership Claim
                  </Link>
                ) : (
                  <Link to="/login" className="btn btn-primary">
                    Sign In to Claim This Item
                  </Link>
                ))}

              {!isFound && !isAdmin && lostItem!.isMine && (lostItem!.status === 'Missing' || lostItem!.status === 'Matched') && (
                <>
                  <Link to={`/report-lost?edit=${lostItem!.id}`} className="btn btn-secondary">
                    Edit Report
                  </Link>
                  <button type="button" className="btn btn-danger" onClick={requestOwnerWithdraw}>
                    Withdraw Report
                  </button>
                </>
              )}

              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditModalOpen(true)}
                  >
                    <Pencil size={15} /> Admin Edit / Upload Photo
                  </button>
                  {((isFound && foundItem!.status !== 'Returned') ||
                    (!isFound && lostItem!.status !== 'Claimed')) && (
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={requestAdminMarkRecovered}
                    >
                      <CheckCircle2 size={15} /> {isFound ? 'Mark Returned to Owner' : 'Mark Found by Owner'}
                    </button>
                  )}
                  <button type="button" className="btn btn-danger" onClick={requestAdminDelete}>
                    <Trash2 size={15} /> Delete Item
                  </button>
                </>
              )}
            </div>
          </div>

          <aside className="card">
            <div className="row-gap" style={{ marginBottom: 8 }}>
              <Sparkles size={18} color="#1d63dc" />
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Suggested Matches</h2>
            </div>

            <div className="alert alert-warning small">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {(isFound ? foundMatches?.disclaimer : lostMatches?.disclaimer) ||
                  'Suggested matches only. Staff verification is required before any item is released.'}
              </span>
            </div>

            {isFound ? (
              foundMatches && foundMatches.matches.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {foundMatches.matches.map((match) => (
                    <div key={match.item.id} className="card card-compact">
                      <div className="row-between">
                        <strong>{match.item.itemName}</strong>
                        <span className="badge badge-purple">{match.score}% match</span>
                      </div>
                      <p className="muted small" style={{ margin: '6px 0' }}>
                        {match.reasons.join(' · ')}
                      </p>
                      <Link to={`/lost/${match.item.id}`} className="btn btn-secondary btn-sm">
                        Inspect lost report
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">No suggested lost-item matches found yet.</p>
              )
            ) : lostMatches && lostMatches.matches.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {lostMatches.matches.map((match) => (
                  <div key={match.item.id} className="card card-compact">
                    <div className="row-between">
                      <strong>{match.item.itemName}</strong>
                      <span className="badge badge-purple">{match.score}% match</span>
                    </div>
                    <p className="muted small" style={{ margin: '6px 0' }}>
                      {match.reasons.join(' · ')}
                    </p>
                    <div className="row-gap">
                      <Link to={`/found/${match.item.id}`} className="btn btn-secondary btn-sm">
                        View found item
                      </Link>
                      {user && (
                        <Link
                          to={`/claims/new/${match.item.id}?lostItemId=${lostItem!.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Submit Claim
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">No suggested found-item matches yet. Check back as new items are logged.</p>
            )}
          </aside>
        </div>

        {isAdmin && (
          <AdminItemModal
            open={editModalOpen}
            kind={kind}
            mode="edit"
            initialLost={lostItem}
            initialFound={foundItem}
            locations={locations}
            onClose={() => setEditModalOpen(false)}
            onSaved={(msg) => {
              setSuccess(msg);
              void loadItem();
            }}
          />
        )}

        <ConfirmDialog
          open={Boolean(confirmState?.open)}
          title={confirmState?.title || ''}
          message={confirmState?.message || ''}
          confirmLabel={confirmState?.confirmLabel || 'Confirm'}
          tone={confirmState?.tone || 'primary'}
          busy={actionBusy}
          onConfirm={executeConfirm}
          onCancel={() => setConfirmState(null)}
        />
      </div>
    </section>
  );
}
