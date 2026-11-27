import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck,
  Package,
  PlusCircle,
  Search,
  ShieldCheck
} from 'lucide-react';
import { claimsApi, foundItemsApi, lostItemsApi } from '../api/client';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { Claim, FoundItem, LostItem } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const [lostReports, setLostReports] = useState<LostItem[]>([]);
  const [foundReports, setFoundReports] = useState<FoundItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      lostItemsApi.list({ mine: true, limit: 20 }),
      foundItemsApi.list({ mine: true, limit: 20 }),
      claimsApi.list({ limit: 20 })
    ])
      .then(([lostRes, foundRes, claimsRes]) => {
        if (!mounted) return;
        setLostReports(lostRes.items);
        setFoundReports(foundRes.items);
        setClaims(claimsRes.claims);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load dashboard activity.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openLost = lostReports.filter((i) => i.status === 'Missing' || i.status === 'Matched').length;
  const pendingClaims = claims.filter((c) => c.status === 'Pending' || c.status === 'Under Review').length;
  const approvedClaims = claims.filter((c) => c.status === 'Approved').length;

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>My Campus Dashboard</h1>
            <p>
              {user?.studentId} · {user?.course} · {user?.role === 'admin' ? 'Administrator' : 'Student'}
            </p>
          </div>
          <div className="row-gap">
            <Link to="/report-lost" className="btn btn-primary btn-sm">
              <PlusCircle size={15} /> Report Lost
            </Link>
            <Link to="/report-found" className="btn btn-secondary btn-sm">
              <PlusCircle size={15} /> Report Found
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className="btn btn-success btn-sm">
                <ShieldCheck size={15} /> Admin Panel
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-circle red">
              <ClipboardList size={22} />
            </div>
            <div>
              <div className="kpi-label">Open Lost Reports</div>
              <div className="kpi-value">{openLost}</div>
              <div className="kpi-sub">{lostReports.length} filed overall</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-circle">
              <Package size={22} />
            </div>
            <div>
              <div className="kpi-label">Found Items Logged</div>
              <div className="kpi-value">{foundReports.length}</div>
              <div className="kpi-sub">Turned in across campus</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-circle gold">
              <Clock size={22} />
            </div>
            <div>
              <div className="kpi-label">Active Claims</div>
              <div className="kpi-value">{pendingClaims}</div>
              <div className="kpi-sub">Awaiting verification</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-circle emerald">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="kpi-label">Approved Claims</div>
              <div className="kpi-value">{approvedClaims}</div>
              <div className="kpi-sub">Verified releases</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state" role="status">
            Loading your recent activity…
          </div>
        ) : (
          <div className="dashboard-split">
            <div style={{ display: 'grid', gap: 20 }}>
              <div className="card">
                <div className="row-between" style={{ marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={18} color="#0e4d9c" /> Recent Lost Reports
                  </h2>
                  <Link to="/my-submissions" className="small" style={{ color: '#0e4d9c', fontWeight: 700 }}>
                    View all
                  </Link>
                </div>
                {lostReports.length === 0 ? (
                  <p className="muted small">You have not filed any lost-item reports yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {lostReports.slice(0, 4).map((item) => (
                      <Link key={item.id} to={`/lost/${item.id}`} className="card-compact">
                        <div className="row-between">
                          <strong>{item.itemName}</strong>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          {item.lastKnownLocation} · {formatDate(item.dateLost)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="row-between" style={{ marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileCheck size={18} color="#0e4d9c" /> Recent Ownership Claims
                  </h2>
                  <Link to="/my-submissions?tab=claims" className="small" style={{ color: '#0e4d9c', fontWeight: 700 }}>
                    Track all
                  </Link>
                </div>
                {claims.length === 0 ? (
                  <p className="muted small">You have not submitted any ownership claims yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {claims.slice(0, 4).map((claim) => (
                      <div key={claim.id} className="card-compact">
                        <div className="row-between">
                          <strong>{claim.foundItem?.itemName || claim.referenceCode}</strong>
                          <StatusBadge status={claim.status} />
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Ref: {claim.referenceCode} · Filed {formatDate(claim.createdAt)}
                        </div>
                        {claim.verificationNotes && (
                          <div className="small" style={{ marginTop: 6, color: '#334155' }}>
                            Staff note: {claim.verificationNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              <div className="action-banner-card">
                <span className="badge" style={{ background: 'rgba(245,183,0,0.22)', color: '#fff6d6' }}>
                  QUICK RECOVERY
                </span>
                <h3>Missing something on campus?</h3>
                <p>
                  Browse recently turned-in items or file a lost report so our matching engine alerts
                  you to potential matches.
                </p>
                <div className="row-gap">
                  <Link to="/found" className="btn btn-white btn-sm">
                    <Search size={15} /> Browse Found
                  </Link>
                  <Link to="/report-lost" className="btn btn-ghost-light btn-sm">
                    <PlusCircle size={15} /> Report Lost
                  </Link>
                </div>
              </div>

              <div className="card">
                <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: '1.05rem' }}>Profile Summary</h2>
                <div className="small" style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <span className="muted">Name:</span> <strong>{user?.fullName}</strong>
                  </div>
                  <div>
                    <span className="muted">Student ID:</span> <strong>{user?.studentId}</strong>
                  </div>
                  <div>
                    <span className="muted">Email:</span> <strong>{user?.email}</strong>
                  </div>
                  <div>
                    <span className="muted">Phone:</span> <strong>{user?.phone}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
