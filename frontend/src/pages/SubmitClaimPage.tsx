import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { claimsApi, foundItemsApi, lostItemsApi } from '../api/client';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import type { FoundItem, LostItem } from '../types';

export function SubmitClaimPage() {
  const { foundItemId } = useParams<{ foundItemId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [foundItem, setFoundItem] = useState<FoundItem | null>(null);
  const [myLostItems, setMyLostItems] = useState<LostItem[]>([]);
  const [linkedLostItemId, setLinkedLostItemId] = useState(searchParams.get('lostItemId') || '');
  const [explanation, setExplanation] = useState('');
  const [identifyingProof, setIdentifyingProof] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!foundItemId) return;
    Promise.all([foundItemsApi.getById(foundItemId), lostItemsApi.list({ mine: true, limit: 30 })])
      .then(([foundRes, lostRes]) => {
        setFoundItem(foundRes.item);
        setMyLostItems(lostRes.items.filter((i) => i.status === 'Missing' || i.status === 'Matched'));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load found item.'))
      .finally(() => setLoading(false));
  }, [foundItemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundItemId) return;
    setError('');
    setSubmitting(true);
    try {
      await claimsApi.create({
        foundItemId,
        linkedLostItemId: linkedLostItemId || undefined,
        explanation: explanation.trim(),
        identifyingProof: identifyingProof.trim()
      });
      navigate('/my-submissions?tab=claims');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="container" style={{ maxWidth: 740 }}>
        <div style={{ marginBottom: 14 }}>
          <Link to={foundItemId ? `/found/${foundItemId}` : '/found'} className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} /> Back to item
          </Link>
        </div>

        <div className="card">
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Submit Ownership Claim</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Provide specific details only the true owner would know. Staff will compare your proof
            against private intake notes before releasing the item.
          </p>

          {loading ? (
            <div className="loading-state" role="status">
              Loading found item…
            </div>
          ) : !foundItem ? (
            <div className="alert alert-error" role="alert">
              {error || 'Found item not found.'}
            </div>
          ) : (
            <>
              <div className="card card-compact" style={{ background: '#f8fafc', marginBottom: 18 }}>
                <div className="row-between">
                  <strong>{foundItem.itemName}</strong>
                  <StatusBadge status={foundItem.status} />
                </div>
                <p className="muted small" style={{ margin: '6px 0' }}>
                  {foundItem.description}
                </p>
                <div className="muted small">
                  Found at {foundItem.locationFound} on {formatDate(foundItem.dateFound)} · Held at{' '}
                  {foundItem.holdingLocation}
                </div>
              </div>

              <div className="alert alert-info small">
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                <span>
                  Claims can only be submitted on your own behalf. You will be asked to present your
                  student ID in person when collecting an approved item.
                </span>
              </div>

              {error && (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="form-grid">
                {myLostItems.length > 0 && (
                  <div className="field form-full">
                    <label htmlFor="claim-linked">Link one of your open lost reports (optional)</label>
                    <select
                      id="claim-linked"
                      value={linkedLostItemId}
                      onChange={(e) => setLinkedLostItemId(e.target.value)}
                    >
                      <option value="">Do not link a lost report</option>
                      {myLostItems.map((lost) => (
                        <option key={lost.id} value={lost.id}>
                          {lost.itemName} — lost near {lost.lastKnownLocation} ({formatDate(lost.dateLost)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field form-full">
                  <label htmlFor="claim-explanation">How and when did you lose this item? *</label>
                  <textarea
                    id="claim-explanation"
                    required
                    minLength={10}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Describe the time, place, and circumstances when the item went missing."
                  />
                </div>

                <div className="field form-full">
                  <label htmlFor="claim-proof">Private proof of ownership *</label>
                  <textarea
                    id="claim-proof"
                    required
                    minLength={5}
                    value={identifyingProof}
                    onChange={(e) => setIdentifyingProof(e.target.value)}
                    placeholder="List hidden markings, serial digits, contents, wallpaper, stickers, or receipts."
                  />
                </div>

                <div className="form-full row-gap">
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting claim…' : 'Submit Ownership Claim'}
                  </button>
                  <Link to={`/found/${foundItem.id}`} className="btn btn-secondary">
                    Cancel
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
