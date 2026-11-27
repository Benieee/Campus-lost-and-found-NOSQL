import { Link } from 'react-router-dom';
import { BarChart3, Download, Lock, Printer, ShieldAlert } from 'lucide-react';
import { formatDateTime } from './StatusBadge';
import type { AdminSystemReport } from '../types';

interface AdminReportsTabProps {
  report: AdminSystemReport | null;
  onRefresh: () => void;
}

export function AdminReportsTab({ report, onRefresh }: AdminReportsTabProps) {
  if (!report) {
    return <div className="loading-state">Generating system report…</div>;
  }

  const exportCsv = () => {
    const lines = [
      'Section,Label,Metric 1,Metric 2,Metric 3,Metric 4',
      `Summary,Totals,Lost=${report.totals.lostReports},Found=${report.totals.foundItems},Returned=${report.totals.returnedItems},RecoveryRate=${report.totals.recoveryRatePercent}%`,
      `Summary,Claims,Total=${report.claimsBreakdown.total},Pending=${report.claimsBreakdown.pending},Approved=${report.claimsBreakdown.approved},Rejected=${report.claimsBreakdown.rejected}`,
      `Summary,Moderation,OpenFlags=${report.moderationSummary.openFlags},ResolvedFlags=${report.moderationSummary.resolvedFlags},HiddenListings=${report.moderationSummary.hiddenListings},Overdue60d=${report.overdueSummary.policyDue60d}`,
      ...report.byCategory.map(
        (c) => `Category,"${c.category}",Lost=${c.lostCount},Found=${c.foundCount},Returned=${c.returnedCount},`
      ),
      ...report.byHoldingDesk.map(
        (d) =>
          `HoldingDesk,"${d.holdingLocation}",Stored=${d.stored},ClaimPending=${d.claimPending},Returned=${d.returned},Archived=${d.archived}`
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bugema-lost-found-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="row-between no-print">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={19} color="#0e4d9c" /> Campus Lost &amp; Found System Report
          </h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Generated {formatDateTime(report.generatedAt)}
          </p>
        </div>
        <div className="row-gap">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
            Refresh Report
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={15} /> Print Report
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Recovery Rate</div>
            <div className="kpi-value">{report.totals.recoveryRatePercent}%</div>
            <div className="kpi-sub">
              {report.totals.returnedItems} of {report.totals.foundItems} found returned
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Claims Processed</div>
            <div className="kpi-value">{report.claimsBreakdown.total}</div>
            <div className="kpi-sub">
              {report.claimsBreakdown.approved} approved · {report.claimsBreakdown.rejected} rejected
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Overdue &amp; Policy</div>
            <div className="kpi-value">{report.overdueSummary.overdueFound30d}</div>
            <div className="kpi-sub">
              {report.overdueSummary.policyDue60d} past 60d · {report.overdueSummary.policyActionsApplied} actioned
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Moderation &amp; Privacy</div>
            <div className="kpi-value">{report.moderationSummary.openFlags}</div>
            <div className="kpi-sub">
              open flags · {report.privacyAlerts.length} privacy warning(s)
            </div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1.02rem' }}>Activity by Item Category</h3>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Lost</th>
                  <th>Found</th>
                  <th>Returned</th>
                </tr>
              </thead>
              <tbody>
                {report.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td data-label="Category"><strong>{row.category}</strong></td>
                    <td data-label="Lost">{row.lostCount}</td>
                    <td data-label="Found">{row.foundCount}</td>
                    <td data-label="Returned">{row.returnedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1.02rem' }}>Found Inventory by Holding Desk</h3>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Holding Desk</th>
                  <th>Stored</th>
                  <th>Claim Pending</th>
                  <th>Returned</th>
                  <th>Archived</th>
                </tr>
              </thead>
              <tbody>
                {report.byHoldingDesk.map((desk) => (
                  <tr key={desk.holdingLocation}>
                    <td data-label="Holding Desk"><strong>{desk.holdingLocation}</strong></td>
                    <td data-label="Stored">{desk.stored}</td>
                    <td data-label="Claim Pending">{desk.claimPending}</td>
                    <td data-label="Returned">{desk.returned}</td>
                    <td data-label="Archived">{desk.archived}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={17} color="#0e4d9c" /> Public Listing Privacy Audit
          </h3>
          <span className={`badge ${report.privacyAlerts.length > 0 ? 'badge-red' : 'badge-green'}`}>
            {report.privacyAlerts.length > 0
              ? `${report.privacyAlerts.length} listing(s) need redaction`
              : 'All public listings clean'}
          </span>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Automatically checks public titles and descriptions for accidental phone numbers, emails, student IDs, or serial numbers so sensitive details are never exposed publicly.
        </p>
        {report.privacyAlerts.length === 0 ? (
          <div className="alert alert-success small" style={{ marginBottom: 0 }}>
            No exposed emails, phone numbers, student IDs, or serial references were detected in public listing text. Private identifying details remain restricted to authorized staff and record owners.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {report.privacyAlerts.map((alert) => (
              <div key={`${alert.type}-${alert.id}`} className="card card-compact" style={{ background: '#fef2f2' }}>
                <div className="row-between">
                  <div>
                    <span className="badge badge-red">
                      <ShieldAlert size={12} /> {alert.type}
                    </span>{' '}
                    <Link
                      to={alert.type === 'LostItem' ? `/lost/${alert.id}` : `/found/${alert.id}`}
                      style={{ fontWeight: 700, color: '#991b1b' }}
                    >
                      {alert.itemName}
                    </Link>
                  </div>
                  <Link
                    to={alert.type === 'LostItem' ? `/lost/${alert.id}` : `/found/${alert.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Inspect &amp; Redact
                  </Link>
                </div>
                <div className="small" style={{ marginTop: 6, color: '#991b1b' }}>
                  {alert.warnings.join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
