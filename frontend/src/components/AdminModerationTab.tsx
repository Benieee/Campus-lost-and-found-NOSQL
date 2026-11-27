import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, EyeOff, Flag, ShieldAlert } from 'lucide-react';
import { reportsApi } from '../api/client';
import { formatDateTime } from './StatusBadge';
import {
  FLAG_REPORT_REASONS,
  FLAG_REPORT_STATUSES,
  type FlagReport,
  type FlagReportStatus
} from '../types';

interface AdminModerationTabProps {
  reports: FlagReport[];
  statusFilter: string;
  reasonFilter: string;
  onStatusFilterChange: (val: string) => void;
  onReasonFilterChange: (val: string) => void;
  onActionSuccess: (msg: string) => void;
  onActionError: (msg: string) => void;
}

export function AdminModerationTab({
  reports,
  statusFilter,
  reasonFilter,
  onStatusFilterChange,
  onReasonFilterChange,
  onActionSuccess,
  onActionError
}: AdminModerationTabProps) {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [actionById, setActionById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleUpdate = async (report: FlagReport, nextStatus: FlagReportStatus) => {
    const notes = (notesById[report.id] ?? report.resolutionNotes ?? '').trim();
    if (notes.length < 3) {
      onActionError('Please enter resolution notes (at least 3 characters) before updating a flagged report.');
      return;
    }
    setBusyId(report.id);
    onActionError('');
    try {
      await reportsApi.review(report.id, {
        status: nextStatus,
        resolutionNotes: notes,
        actionTaken: (actionById[report.id] ?? report.actionTaken ?? '').trim() || undefined
      });
      onActionSuccess(`Flagged report for "${report.targetLabel}" updated to ${nextStatus}.`);
    } catch (err) {
      onActionError(err instanceof Error ? err.message : 'Unable to update flagged report.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="alert alert-info small" style={{ marginBottom: 14 }}>
        <ShieldAlert size={18} style={{ flexShrink: 0 }} />
        <span>
          Review reports of <strong>inaccurate listings, duplicate entries, suspicious claims, privacy risks, or inappropriate content</strong>. Record resolution notes and any action taken for the campus audit log.
        </span>
      </div>

      <div className="row-gap" style={{ marginBottom: 14 }}>
        <select
          aria-label="Filter reports by status"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
        >
          <option value="">All report statuses</option>
          {FLAG_REPORT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter reports by reason"
          value={reasonFilter}
          onChange={(e) => onReasonFilterChange(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
        >
          <option value="">All issue reasons</option>
          {FLAG_REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">No flagged reports match the current filter.</div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {reports.map((report) => {
            const targetLink =
              report.targetType === 'LostItem'
                ? `/lost/${report.targetId}`
                : report.targetType === 'FoundItem'
                  ? `/found/${report.targetId}`
                  : null;

            return (
              <div key={report.id} className="card">
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <div className="row-gap">
                    <span
                      className={`badge ${
                        report.reason === 'Suspicious Claim' || report.reason === 'Privacy Risk'
                          ? 'badge-red'
                          : report.reason === 'Inappropriate Content'
                            ? 'badge-amber'
                            : 'badge-purple'
                      }`}
                    >
                      <Flag size={12} /> {report.reason}
                    </span>
                    <span className="badge badge-slate">{report.targetType}</span>
                    {targetLink ? (
                      <Link to={targetLink} style={{ fontWeight: 700, color: '#0e4d9c' }}>
                        {report.targetLabel}
                      </Link>
                    ) : (
                      <strong>{report.targetLabel}</strong>
                    )}
                  </div>
                  <span
                    className={`badge ${
                      report.status === 'Resolved'
                        ? 'badge-green'
                        : report.status === 'Dismissed'
                          ? 'badge-slate'
                          : report.status === 'Investigating'
                            ? 'badge-amber'
                            : 'badge-red'
                    }`}
                  >
                    {report.status}
                  </span>
                </div>

                <p className="small" style={{ margin: '0 0 8px' }}>
                  <strong>Report details:</strong> {report.details}
                </p>
                <div className="muted small" style={{ marginBottom: 12 }}>
                  Reported by <strong>{report.reportedBy?.fullName || 'Campus User'}</strong>
                  {report.reportedBy?.studentId ? ` (${report.reportedBy.studentId})` : ''} ·{' '}
                  {formatDateTime(report.createdAt)}
                  {report.resolvedBy && (
                    <>
                      {' '}
                      · Last handled by <strong>{report.resolvedBy.fullName}</strong> on{' '}
                      {formatDateTime(report.resolvedAt)}
                    </>
                  )}
                </div>

                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <div className="field">
                    <label htmlFor={`flag-action-${report.id}`}>Action taken (optional)</label>
                    <input
                      id={`flag-action-${report.id}`}
                      value={actionById[report.id] ?? report.actionTaken ?? ''}
                      onChange={(e) => setActionById({ ...actionById, [report.id]: e.target.value })}
                      placeholder="e.g. Hidden duplicate listing / Redacted phone number / Rejected claim"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`flag-notes-${report.id}`}>Resolution notes *</label>
                    <input
                      id={`flag-notes-${report.id}`}
                      value={notesById[report.id] ?? report.resolutionNotes ?? ''}
                      onChange={(e) => setNotesById({ ...notesById, [report.id]: e.target.value })}
                      placeholder="Explain verification findings and outcome"
                    />
                  </div>
                </div>

                <div className="row-gap">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === report.id}
                    onClick={() => void handleUpdate(report, 'Investigating')}
                  >
                    <AlertTriangle size={14} /> Mark Investigating
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={busyId === report.id || report.status === 'Resolved'}
                    onClick={() => void handleUpdate(report, 'Resolved')}
                  >
                    <CheckCircle2 size={14} /> Mark Resolved
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === report.id || report.status === 'Dismissed'}
                    onClick={() => void handleUpdate(report, 'Dismissed')}
                  >
                    <EyeOff size={14} /> Dismiss Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
