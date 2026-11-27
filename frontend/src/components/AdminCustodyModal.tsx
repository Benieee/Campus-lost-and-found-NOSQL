import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, PackageCheck, Warehouse, X } from 'lucide-react';
import { foundItemsApi } from '../api/client';
import { formatDateTime } from './StatusBadge';
import {
  CUSTODY_EVENT_TYPES,
  type CampusLocation,
  type CustodyEventType,
  type FoundItem
} from '../types';

interface AdminCustodyModalProps {
  open: boolean;
  item: FoundItem | null;
  locations: CampusLocation[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function AdminCustodyModal({
  open,
  item,
  locations,
  onClose,
  onSaved
}: AdminCustodyModalProps) {
  const [eventType, setEventType] = useState<CustodyEventType>('Transferred');
  const [location, setLocation] = useState('');
  const [storageBin, setStorageBin] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    setEventType('Transferred');
    setLocation(item.holdingLocation || '');
    setStorageBin(item.storageBin || '');
    setRecipientName('');
    setRecipientId('');
    setNotes('');
    setError('');
  }, [open, item]);

  if (!open || !item) return null;

  const holdingDesks = locations.filter((l) => l.isHoldingDesk && l.isActive);
  const history = item.custodyHistory || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await foundItemsApi.logCustody(item.id, {
        eventType,
        location: location.trim(),
        storageBin: storageBin.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        recipientId: recipientId.trim() || undefined,
        notes: notes.trim() || undefined
      });
      onSaved(
        eventType === 'Collected'
          ? `Recorded collection of "${item.itemName}" and marked as Returned.`
          : `Logged ${eventType.toLowerCase()} custody update for "${item.itemName}".`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save custody update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="custody-modal-title">
      <div className="modal-card" style={{ width: 'min(740px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 id="custody-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Warehouse size={18} /> Storage, Transfer &amp; Collection Log
            </h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {item.itemName} · Currently at <strong>{item.holdingLocation}</strong>
              {item.storageBin ? ` (${item.storageBin})` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-grid" style={{ marginBottom: 18 }}>
          <div className="field">
            <label htmlFor="custody-type">Custody action *</label>
            <select
              id="custody-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CustodyEventType)}
            >
              {CUSTODY_EVENT_TYPES.filter((t) => t !== 'Policy Action').map((t) => (
                <option key={t} value={t}>
                  {t === 'Stored'
                    ? 'Stored (Update Bin/Shelf)'
                    : t === 'Transferred'
                      ? 'Transferred (Move to Another Desk)'
                      : 'Collected (Release to Owner)'}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="custody-location">Holding desk / destination *</label>
            <input
              id="custody-location"
              list="custody-holding-desks"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Gate Security Desk"
            />
            <datalist id="custody-holding-desks">
              {holdingDesks.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label htmlFor="custody-bin">Storage shelf / bin / locker</label>
            <input
              id="custody-bin"
              value={storageBin}
              onChange={(e) => setStorageBin(e.target.value)}
              placeholder="e.g. Locker A-05, Safe Drawer 1"
            />
          </div>

          {eventType === 'Collected' ? (
            <>
              <div className="field">
                <label htmlFor="custody-recipient">Collected by (full name) *</label>
                <input
                  id="custody-recipient"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Student or owner full name"
                />
              </div>
              <div className="field">
                <label htmlFor="custody-recipient-id">Student / Staff ID checked *</label>
                <input
                  id="custody-recipient-id"
                  required
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder="e.g. 24/BIT/BU/R/0101"
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="custody-recipient">Received / handled by (optional)</label>
              <input
                id="custody-recipient"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Desk officer receiving transfer"
              />
            </div>
          )}

          <div className="field form-full">
            <label htmlFor="custody-notes">Custody / handover notes</label>
            <input
              id="custody-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Transferred to central desk for evening pickup / ID verified and signed"
            />
          </div>

          <div className="modal-actions form-full">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {eventType === 'Collected' ? <PackageCheck size={15} /> : <ArrowRightLeft size={15} />}{' '}
              {saving ? 'Recording…' : `Record ${eventType}`}
            </button>
          </div>
        </form>

        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.98rem' }}>Chain-of-Custody History ({history.length})</h3>
          {history.length === 0 ? (
            <p className="muted small">No custody events logged yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {[...history].reverse().map((ev, idx) => (
                <div key={idx} className="card card-compact" style={{ padding: 12, background: '#f8fafc' }}>
                  <div className="row-between">
                    <span
                      className={`badge ${
                        ev.eventType === 'Collected'
                          ? 'badge-green'
                          : ev.eventType === 'Transferred'
                            ? 'badge-blue'
                            : ev.eventType === 'Policy Action'
                              ? 'badge-purple'
                              : 'badge-slate'
                      }`}
                    >
                      {ev.eventType}
                    </span>
                    <span className="muted small">{formatDateTime(ev.timestamp)}</span>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    <strong>Location:</strong> {ev.location}
                    {ev.storageBin ? ` · Bin/Shelf: ${ev.storageBin}` : ''}
                  </div>
                  {(ev.recipientName || ev.recipientId) && (
                    <div className="small" style={{ marginTop: 2 }}>
                      <strong>Recipient:</strong> {ev.recipientName || 'N/A'}
                      {ev.recipientId ? ` (${ev.recipientId})` : ''}
                    </div>
                  )}
                  {ev.notes && (
                    <div className="small muted" style={{ marginTop: 2 }}>
                      {ev.notes}
                    </div>
                  )}
                  {ev.recordedByName && (
                    <div className="muted small" style={{ marginTop: 2 }}>
                      Logged by {ev.recordedByName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
