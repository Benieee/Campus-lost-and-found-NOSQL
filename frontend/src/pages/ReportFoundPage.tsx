import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { foundItemsApi, locationsApi, resolveMediaUrl, uploadsApi } from '../api/client';
import { ITEM_CATEGORIES, type CampusLocation, type ItemCategory } from '../types';

export function ReportFoundPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [form, setForm] = useState({
    itemName: '',
    category: 'Electronics' as ItemCategory,
    description: '',
    identifyingDetails: '',
    locationFound: '',
    locationRef: '',
    dateFound: new Date().toISOString().slice(0, 10),
    holdingLocation: '',
    imageUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    locationsApi.list().then((res) => setLocations(res.locations)).catch(() => {});
  }, []);

  const holdingDesks = locations.filter((l) => l.isHoldingDesk);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setForm((prev) => ({ ...prev, imageUrl: res.imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleLocationSelect = (locId: string) => {
    const found = locations.find((l) => l.id === locId);
    setForm((prev) => ({
      ...prev,
      locationRef: locId,
      locationFound: found ? found.name : prev.locationFound
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await foundItemsApi.create({
        itemName: form.itemName.trim(),
        category: form.category,
        description: form.description.trim(),
        identifyingDetails: form.identifyingDetails.trim(),
        locationFound: form.locationFound.trim(),
        locationRef: form.locationRef || undefined,
        dateFound: form.dateFound,
        holdingLocation: form.holdingLocation.trim(),
        imageUrl: form.imageUrl || undefined
      });
      navigate(`/found/${res.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record found item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="container" style={{ maxWidth: 780 }}>
        <div className="page-header">
          <div>
            <h1>Report a Found Item</h1>
            <p>
              Enter a safe public description and keep unique identifying marks in the private field so
              staff can verify the rightful owner.
            </p>
          </div>
        </div>

        <div className="card">
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field">
              <label htmlFor="found-name">Item name *</label>
              <input
                id="found-name"
                required
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder="e.g. HP Laptop Power Adapter"
              />
            </div>

            <div className="field">
              <label htmlFor="found-cat">Category *</label>
              <select
                id="found-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ItemCategory })}
              >
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="field form-full">
              <label htmlFor="found-desc">General public description *</label>
              <textarea
                id="found-desc"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Broad description without giving away secret marks (visible publicly)"
              />
            </div>

            <div className="field form-full">
              <label htmlFor="found-private">Private identifying details (staff verification only) *</label>
              <textarea
                id="found-private"
                required
                value={form.identifyingDetails}
                onChange={(e) => setForm({ ...form, identifyingDetails: e.target.value })}
                placeholder="Exact serial suffix, stickers, contents, or markings — NEVER displayed to claimants"
              />
              <span className="field-hint">
                Hidden from public visitors and other students to prevent fraudulent claims.
              </span>
            </div>

            <div className="field">
              <label htmlFor="found-loc-ref">Campus location found (preset)</label>
              <select
                id="found-loc-ref"
                value={form.locationRef}
                onChange={(e) => handleLocationSelect(e.target.value)}
              >
                <option value="">Select campus location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="found-loc-text">Location found *</label>
              <input
                id="found-loc-text"
                required
                value={form.locationFound}
                onChange={(e) => setForm({ ...form, locationFound: e.target.value })}
                placeholder="e.g. ICT Lab Block B, Desk 12"
              />
            </div>

            <div className="field">
              <label htmlFor="found-date">Date found *</label>
              <input
                id="found-date"
                type="date"
                required
                value={form.dateFound}
                onChange={(e) => setForm({ ...form, dateFound: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="found-holding">Where the item is being held *</label>
              <input
                id="found-holding"
                list="holding-desks-list"
                required
                value={form.holdingLocation}
                onChange={(e) => setForm({ ...form, holdingLocation: e.target.value })}
                placeholder="e.g. Main Gate Security Desk"
              />
              <datalist id="holding-desks-list">
                {holdingDesks.map((desk) => (
                  <option key={desk.id} value={desk.name} />
                ))}
              </datalist>
            </div>

            <div className="field form-full">
              <label htmlFor="found-img">Optional photo (avoid photographing sensitive ID numbers; max 2 MB)</label>
              <input
                id="found-img"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                disabled={uploading}
              />
              {uploading && <span className="field-hint">Validating and uploading image…</span>}
            </div>

            {form.imageUrl && (
              <div className="form-full">
                <img
                  src={resolveMediaUrl(form.imageUrl)}
                  alt="Uploaded found item preview"
                  style={{ maxHeight: 180, borderRadius: 10, border: '1px solid #e2e8f0' }}
                />
              </div>
            )}

            <div className="form-full row-gap" style={{ marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
                {submitting ? 'Recording…' : 'Submit Found Report'}
              </button>
              <Link to="/found" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
