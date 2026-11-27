import React, { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { foundItemsApi, lostItemsApi, resolveMediaUrl, uploadsApi } from '../api/client';
import {
  FOUND_STATUSES,
  ITEM_CATEGORIES,
  LOST_STATUSES,
  MODERATION_STATUSES,
  type CampusLocation,
  type ContactPreference,
  type FoundItem,
  type FoundItemStatus,
  type ItemCategory,
  type ListingModerationStatus,
  type LostItem,
  type LostItemStatus
} from '../types';

interface AdminItemModalProps {
  open: boolean;
  kind: 'lost' | 'found';
  mode: 'create' | 'edit';
  initialLost?: LostItem | null;
  initialFound?: FoundItem | null;
  locations: CampusLocation[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function AdminItemModal({
  open,
  kind,
  mode,
  initialLost,
  initialFound,
  locations,
  onClose,
  onSaved
}: AdminItemModalProps) {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Electronics');
  const [description, setDescription] = useState('');
  const [identifyingDetails, setIdentifyingDetails] = useState('');
  const [locationText, setLocationText] = useState('');
  const [locationRef, setLocationRef] = useState('');
  const [holdingLocation, setHoldingLocation] = useState('');
  const [storageBin, setStorageBin] = useState('');
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10));
  const [approxTime, setApproxTime] = useState('');
  const [contactPreference, setContactPreference] = useState<ContactPreference>('email');
  const [lostStatus, setLostStatus] = useState<LostItemStatus>('Missing');
  const [foundStatus, setFoundStatus] = useState<FoundItemStatus>('Stored');
  const [moderationStatus, setModerationStatus] = useState<ListingModerationStatus>('Approved');
  const [moderationNotes, setModerationNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (kind === 'lost' && mode === 'edit' && initialLost) {
      setItemName(initialLost.itemName);
      setCategory(initialLost.category);
      setDescription(initialLost.description);
      setIdentifyingDetails(initialLost.identifyingDetails || '');
      setLocationText(initialLost.lastKnownLocation);
      setLocationRef(initialLost.locationRef || '');
      setDateValue(initialLost.dateLost ? initialLost.dateLost.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setApproxTime(initialLost.approximateTimeLost || '');
      setContactPreference(initialLost.contactPreference || 'email');
      setLostStatus(initialLost.status);
      setModerationStatus(initialLost.moderationStatus || 'Approved');
      setModerationNotes(initialLost.moderationNotes || '');
      setImageUrl(initialLost.imageUrl || '');
    } else if (kind === 'found' && mode === 'edit' && initialFound) {
      setItemName(initialFound.itemName);
      setCategory(initialFound.category);
      setDescription(initialFound.description);
      setIdentifyingDetails(initialFound.identifyingDetails || '');
      setLocationText(initialFound.locationFound);
      setLocationRef(initialFound.locationRef || '');
      setHoldingLocation(initialFound.holdingLocation);
      setStorageBin(initialFound.storageBin || '');
      setDateValue(initialFound.dateFound ? initialFound.dateFound.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setFoundStatus(initialFound.status);
      setModerationStatus(initialFound.moderationStatus || 'Approved');
      setModerationNotes(initialFound.moderationNotes || '');
      setImageUrl(initialFound.imageUrl || '');
    } else {
      setItemName('');
      setCategory('Electronics');
      setDescription('');
      setIdentifyingDetails('');
      setLocationText('');
      setLocationRef('');
      setHoldingLocation(locations.find((l) => l.isHoldingDesk)?.name || 'Main Gate Security Desk');
      setStorageBin('');
      setDateValue(new Date().toISOString().slice(0, 10));
      setApproxTime('');
      setContactPreference('email');
      setLostStatus('Missing');
      setFoundStatus('Stored');
      setModerationStatus('Approved');
      setModerationNotes('');
      setImageUrl('');
    }
  }, [open, kind, mode, initialLost, initialFound, locations]);

  if (!open) return null;

  const holdingDesks = locations.filter((l) => l.isHoldingDesk && l.isActive);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2 MB or smaller.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const res = await uploadsApi.uploadImage(file);
      setImageUrl(res.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handlePresetLocation = (id: string) => {
    const matched = locations.find((l) => l.id === id);
    setLocationRef(id);
    if (matched) setLocationText(matched.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (kind === 'lost') {
        const payload: Record<string, unknown> = {
          itemName: itemName.trim(),
          category,
          description: description.trim(),
          identifyingDetails: identifyingDetails.trim(),
          lastKnownLocation: locationText.trim(),
          locationRef: locationRef || undefined,
          dateLost: dateValue,
          approximateTimeLost: approxTime.trim() || 'Unknown',
          contactPreference,
          imageUrl: imageUrl || ''
        };
        if (mode === 'edit' && initialLost) {
          payload.status = lostStatus;
          payload.moderationStatus = moderationStatus;
          payload.moderationNotes = moderationNotes.trim();
          await lostItemsApi.update(initialLost.id, payload);
          onSaved(`Updated lost report "${itemName.trim()}".`);
        } else {
          await lostItemsApi.create(payload);
          onSaved(`Uploaded new lost report "${itemName.trim()}".`);
        }
      } else {
        const payload: Record<string, unknown> = {
          itemName: itemName.trim(),
          category,
          description: description.trim(),
          identifyingDetails: identifyingDetails.trim(),
          locationFound: locationText.trim(),
          locationRef: locationRef || undefined,
          dateFound: dateValue,
          holdingLocation: holdingLocation.trim(),
          storageBin: storageBin.trim(),
          imageUrl: imageUrl || ''
        };
        if (mode === 'edit' && initialFound) {
          payload.status = foundStatus;
          payload.moderationStatus = moderationStatus;
          payload.moderationNotes = moderationNotes.trim();
          await foundItemsApi.update(initialFound.id, payload);
          onSaved(`Updated found item "${itemName.trim()}".`);
        } else {
          await foundItemsApi.create(payload);
          onSaved(`Uploaded new found item "${itemName.trim()}".`);
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save item changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-item-modal-title">
      <div className="modal-card" style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 id="admin-item-modal-title" style={{ margin: 0 }}>
            {mode === 'create'
              ? kind === 'found'
                ? 'Upload New Found Item'
                : 'Upload New Lost Report'
              : kind === 'found'
              ? 'Update Found Item'
              : 'Update Lost Report'}
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="field">
            <label htmlFor="adm-item-name">Item name *</label>
            <input
              id="adm-item-name"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="adm-item-cat">Category *</label>
            <select
              id="adm-item-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
            >
              {ITEM_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="field form-full">
            <label htmlFor="adm-item-desc">Public description *</label>
            <textarea
              id="adm-item-desc"
              required
              style={{ minHeight: 74 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field form-full">
            <label htmlFor="adm-item-private">Private identifying details (staff verification) *</label>
            <textarea
              id="adm-item-private"
              required
              style={{ minHeight: 74 }}
              value={identifyingDetails}
              onChange={(e) => setIdentifyingDetails(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="adm-item-loc-ref">Campus location (preset)</label>
            <select
              id="adm-item-loc-ref"
              value={locationRef}
              onChange={(e) => handlePresetLocation(e.target.value)}
            >
              <option value="">Select location</option>
              {locations
                .filter((l) => l.isActive)
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="adm-item-loc-text">
              {kind === 'found' ? 'Location found *' : 'Last-known location *'}
            </label>
            <input
              id="adm-item-loc-text"
              required
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="adm-item-date">{kind === 'found' ? 'Date found *' : 'Date lost *'}</label>
            <input
              id="adm-item-date"
              type="date"
              required
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </div>

          {kind === 'found' ? (
            <>
              <div className="field">
                <label htmlFor="adm-item-holding">Holding desk / location *</label>
                <input
                  id="adm-item-holding"
                  list="adm-holding-desks"
                  required
                  value={holdingLocation}
                  onChange={(e) => setHoldingLocation(e.target.value)}
                />
                <datalist id="adm-holding-desks">
                  {holdingDesks.map((d) => (
                    <option key={d.id} value={d.name} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="adm-item-bin">Storage shelf / bin / locker</label>
                <input
                  id="adm-item-bin"
                  value={storageBin}
                  onChange={(e) => setStorageBin(e.target.value)}
                  placeholder="e.g. Locker A-05 or Safe Drawer 1"
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="adm-item-time">Approximate time lost</label>
              <input
                id="adm-item-time"
                value={approxTime}
                onChange={(e) => setApproxTime(e.target.value)}
                placeholder="e.g. 14:30"
              />
            </div>
          )}

          {mode === 'edit' && (
            <>
              <div className="field">
                <label htmlFor="adm-item-status">Status *</label>
                {kind === 'found' ? (
                  <select
                    id="adm-item-status"
                    value={foundStatus}
                    onChange={(e) => setFoundStatus(e.target.value as FoundItemStatus)}
                  >
                    {FOUND_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id="adm-item-status"
                    value={lostStatus}
                    onChange={(e) => setLostStatus(e.target.value as LostItemStatus)}
                  >
                    {LOST_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="field">
                <label htmlFor="adm-item-moderation">Public visibility / moderation</label>
                <select
                  id="adm-item-moderation"
                  value={moderationStatus}
                  onChange={(e) => setModerationStatus(e.target.value as ListingModerationStatus)}
                >
                  {MODERATION_STATUSES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field form-full">
                <label htmlFor="adm-item-mod-notes">Internal moderation / privacy redaction notes</label>
                <input
                  id="adm-item-mod-notes"
                  value={moderationNotes}
                  onChange={(e) => setModerationNotes(e.target.value)}
                  placeholder="Optional staff note (e.g. Redacted phone number from public description)"
                />
              </div>
            </>
          )}

          {kind === 'lost' && (
            <div className="field">
              <label htmlFor="adm-item-contact">Contact preference</label>
              <select
                id="adm-item-contact"
                value={contactPreference}
                onChange={(e) => setContactPreference(e.target.value as ContactPreference)}
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="in_app">In-app</option>
              </select>
            </div>
          )}

          <div className="field form-full">
            <label htmlFor="adm-item-photo">
              <Upload size={14} style={{ verticalAlign: 'middle' }} /> Upload / Replace Item Photo (JPEG, PNG, WebP, GIF, max 2 MB)
            </label>
            <input
              id="adm-item-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              disabled={uploading}
            />
            {uploading && <span className="field-hint">Validating and uploading photo…</span>}
            {imageUrl && (
              <div className="row-gap" style={{ marginTop: 8 }}>
                <img
                  src={resolveMediaUrl(imageUrl)}
                  alt="Item preview"
                  style={{ maxHeight: 110, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setImageUrl('')}
                >
                  Remove photo
                </button>
              </div>
            )}
          </div>

          <div className="modal-actions form-full" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
              {saving ? 'Saving…' : mode === 'create' ? 'Upload Item' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
