import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { locationsApi, lostItemsApi, resolveMediaUrl, uploadsApi } from '../api/client';
import { ITEM_CATEGORIES, type CampusLocation, type ContactPreference, type ItemCategory } from '../types';

export function ReportLostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [form, setForm] = useState({
    itemName: '',
    category: 'Electronics' as ItemCategory,
    description: '',
    identifyingDetails: '',
    lastKnownLocation: '',
    locationRef: '',
    dateLost: new Date().toISOString().slice(0, 10),
    approximateTimeLost: '',
    contactPreference: 'email' as ContactPreference,
    imageUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    locationsApi.list().then((res) => setLocations(res.locations)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    lostItemsApi
      .getById(editId)
      .then(({ item }) => {
        setForm({
          itemName: item.itemName,
          category: item.category,
          description: item.description,
          identifyingDetails: item.identifyingDetails || '',
          lastKnownLocation: item.lastKnownLocation,
          locationRef: item.locationRef || '',
          dateLost: item.dateLost ? item.dateLost.slice(0, 10) : '',
          approximateTimeLost: item.approximateTimeLost || '',
          contactPreference: item.contactPreference || 'email',
          imageUrl: item.imageUrl || ''
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load report for editing.'))
      .finally(() => setLoadingEdit(false));
  }, [editId]);

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
      lastKnownLocation: found ? found.name : prev.lastKnownLocation
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        itemName: form.itemName.trim(),
        category: form.category,
        description: form.description.trim(),
        identifyingDetails: form.identifyingDetails.trim(),
        lastKnownLocation: form.lastKnownLocation.trim(),
        locationRef: form.locationRef || undefined,
        dateLost: form.dateLost,
        approximateTimeLost: form.approximateTimeLost.trim() || 'Unknown',
        contactPreference: form.contactPreference,
        imageUrl: form.imageUrl || undefined
      };

      const res = editId
        ? await lostItemsApi.update(editId, payload)
        : await lostItemsApi.create(payload);

      navigate(`/lost/${res.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lost-item report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="container" style={{ maxWidth: 780 }}>
        <div className="page-header">
          <div>
            <h1>{editId ? 'Edit Lost-Item Report' : 'Report a Lost Item'}</h1>
            <p>
              General descriptions help with matching, while your private identifying details are shown
              only to you and authorized staff.
            </p>
          </div>
        </div>

        <div className="card">
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loadingEdit ? (
            <div className="loading-state" role="status">
              Loading report details…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="field">
                <label htmlFor="lost-name">Item name *</label>
                <input
                  id="lost-name"
                  required
                  value={form.itemName}
                  onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                  placeholder="e.g. Casio fx-991EX Calculator"
                />
              </div>

              <div className="field">
                <label htmlFor="lost-cat">Category *</label>
                <select
                  id="lost-cat"
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
                <label htmlFor="lost-desc">Public description *</label>
                <textarea
                  id="lost-desc"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Color, brand, general appearance (visible to campus users)"
                />
              </div>

              <div className="field form-full">
                <label htmlFor="lost-private">Private identifying details *</label>
                <textarea
                  id="lost-private"
                  required
                  value={form.identifyingDetails}
                  onChange={(e) => setForm({ ...form, identifyingDetails: e.target.value })}
                  placeholder="Serial number, scratches, stickers, or contents (kept hidden from public)"
                />
                <span className="field-hint">Hidden from unauthenticated visitors and other students.</span>
              </div>

              <div className="field">
                <label htmlFor="lost-loc-ref">Campus location (preset)</label>
                <select
                  id="lost-loc-ref"
                  value={form.locationRef}
                  onChange={(e) => handleLocationSelect(e.target.value)}
                >
                  <option value="">Select a campus building or area</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.buildingArea})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="lost-loc-text">Last-known location *</label>
                <input
                  id="lost-loc-text"
                  required
                  value={form.lastKnownLocation}
                  onChange={(e) => setForm({ ...form, lastKnownLocation: e.target.value })}
                  placeholder="e.g. Science Complex, Lecture Room 4"
                />
              </div>

              <div className="field">
                <label htmlFor="lost-date">Date lost *</label>
                <input
                  id="lost-date"
                  type="date"
                  required
                  value={form.dateLost}
                  onChange={(e) => setForm({ ...form, dateLost: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="lost-time">Approximate time lost</label>
                <input
                  id="lost-time"
                  value={form.approximateTimeLost}
                  onChange={(e) => setForm({ ...form, approximateTimeLost: e.target.value })}
                  placeholder="e.g. 14:30 or Late afternoon"
                />
              </div>

              <div className="field">
                <label htmlFor="lost-contact">Contact preference *</label>
                <select
                  id="lost-contact"
                  value={form.contactPreference}
                  onChange={(e) =>
                    setForm({ ...form, contactPreference: e.target.value as ContactPreference })
                  }
                >
                  <option value="email">Email notification</option>
                  <option value="phone">Phone call / SMS</option>
                  <option value="in_app">Portal status check only</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="lost-img">Optional photo (JPEG, PNG, WebP, GIF, max 2 MB)</label>
                <input
                  id="lost-img"
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
                    alt="Uploaded item preview"
                    style={{ maxHeight: 180, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  />
                </div>
              )}

              <div className="form-full row-gap" style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
                  {submitting ? 'Saving…' : editId ? 'Save Changes' : 'Submit Lost Report'}
                </button>
                <Link to="/my-submissions" className="btn btn-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
