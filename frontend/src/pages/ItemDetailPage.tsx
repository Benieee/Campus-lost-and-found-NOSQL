import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, Lock, MapPin, Package, Sparkles } from 'lucide-react';
import { foundItemsApi, lostItemsApi, resolveMediaUrl } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { FoundItem, LostItem, SuggestedMatchesResponse } from '../types';

export function ItemDetailPage({ kind }: { kind: 'lost' | 'found' }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lostItem, setLostItem] = useState<LostItem | null>(null);
  const [foundItem, setFoundItem] = useState<FoundItem | null>(null);
  const [lostMatches, setLostMatches] = useState<SuggestedMatchesResponse<FoundItem> | null>(null);
  const [foundMatches, setFoundMatches] = useState<SuggestedMatchesResponse<LostItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    if (kind === 'lost') {
      lostItemsApi
        .getById(id)
        .then((res) => {
          setLostItem(res.item);
          setLostMatches(res.suggestedMatches);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load lost item.'))
        .finally(() => setLoading(false));
    } else {
      foundItemsApi
        .getById(id)
        .then((res) => {
          setFoundItem(res.item);
          setFoundMatches(res.suggestedMatches);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load found item.'))
        .finally(() => setLoading(false));
    }
  }, [id, kind]);

  const handleWithdraw = async () => {
    if (!lostItem) return;
    setActionBusy(true);
    try {
      const res = await lostItemsApi.update(lostItem.id, { status: 'Closed' });
      setLostItem(res.item);
      setConfirmWithdraw(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw report.');
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

  if (error || (kind === 'lost' ? !lostItem : !foundItem)) {
    return (
      <section className="page-section">
        <div className="container">
          <div className="alert alert-error" role="alert">
            {error || 'Item record not found.'}
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
  const canClaimFound =
    isFound &&
    (foundItem!.status === 'Stored' || foundItem!.status === 'Claim Pending') &&
    !foundItem!.isMine;

  return (
    <section className="page-section">
      <div className="container">
        <div style={{ marginBottom: 16 }}>
          <Link to={isFound ? '/found' : '/lost'} className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} /> Back to {isFound ? 'Found Items' : 'Lost Reports'}
          </Link>
        </div>

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

              {!isFound && lostItem!.isMine && (lostItem!.status === 'Missing' || lostItem!.status === 'Matched') && (
                <>
                  <Link to={`/report-lost?edit=${lostItem!.id}`} className="btn btn-secondary">
                    Edit Report
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setConfirmWithdraw(true)}
                  >
                    Withdraw Report
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

        <ConfirmDialog
          open={confirmWithdraw}
          title="Withdraw lost-item report?"
          message="Withdrawing marks this report as Closed. You can still view it in your submission history."
          confirmLabel="Yes, withdraw report"
          tone="danger"
          busy={actionBusy}
          onConfirm={handleWithdraw}
          onCancel={() => setConfirmWithdraw(false)}
        />
      </div>
    </section>
  );
}
