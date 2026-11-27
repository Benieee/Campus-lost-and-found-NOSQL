import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Archive,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  Flag,
  MessageCircle,
  Package,
  Pencil,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Warehouse
} from 'lucide-react';
import { adminApi, ApiError, claimsApi, foundItemsApi, locationsApi, lostItemsApi, reportsApi } from '../api/client';
import { AdminCustodyModal } from '../components/AdminCustodyModal';
import { AdminItemModal } from '../components/AdminItemModal';
import { AdminModerationTab } from '../components/AdminModerationTab';
import { AdminOverdueTab } from '../components/AdminOverdueTab';
import { AdminReportsTab } from '../components/AdminReportsTab';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination } from '../components/Pagination';
import { formatDate, formatDateTime, StatusBadge } from '../components/StatusBadge';
import {
  AUDIT_ENTITY_TYPES,
  CLAIM_STATUSES,
  CLAIM_VERIFICATION_METHODS,
  FOUND_STATUSES,
  LOST_STATUSES,
  type AdminMatchPair,
  type AdminSystemReport,
  type AuditLogEntry,
  type CampusLocation,
  type Claim,
  type ClaimStatus,
  type ClaimVerificationMethod,
  type FlagReport,
  type FoundItem,
  type FoundItemStatus,
  type ListingModerationStatus,
  type LostItem,
  type LostItemStatus,
  type PaginationMeta,
  type User,
  type UserRole
} from '../types';

type AdminTab =
  | 'overview'
  | 'claims'
  | 'lost'
  | 'found'
  | 'moderation'
  | 'overdue'
  | 'users'
  | 'locations'
  | 'reports'
  | 'audit';

interface PendingAction {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'primary' | 'danger' | 'success';
  run: () => Promise<void>;
}

interface ItemModalState {
  open: boolean;
  kind: 'lost' | 'found';
  mode: 'create' | 'edit';
  lostItem?: LostItem | null;
  foundItem?: FoundItem | null;
}

function buildWhatsAppLink(phone?: string, message?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 10) {
    digits = `256${digits.slice(1)}`;
  }
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${textParam}`;
}

export function AdminDashboardPage() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [itemModal, setItemModal] = useState<ItemModalState>({
    open: false,
    kind: 'found',
    mode: 'create'
  });
  const [custodyItem, setCustodyItem] = useState<FoundItem | null>(null);

  // Overview / Monitoring state
  const [counts, setCounts] = useState({
    openLostReports: 0,
    foundItemsInStorage: 0,
    foundClaimPending: 0,
    claimsAwaitingReview: 0,
    recentlyReturnedItems: 0,
    totalReturnedItems: 0,
    totalStudents: 0,
    totalStaff: 0,
    activeLocations: 0,
    openFlagReports: 0,
    overdueFoundItems: 0,
    policyDueFoundItems: 0,
    overdueLostItems: 0,
    privacyWarningCount: 0
  });
  const [recentReturns, setRecentReturns] = useState<FoundItem[]>([]);
  const [awaitingClaims, setAwaitingClaims] = useState<Claim[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [suggestedMatches, setSuggestedMatches] = useState<{ disclaimer: string; matches: AdminMatchPair[] } | null>(null);

  // Claims state (including verification method, evidence check, decision reason, outcome)
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsFilter, setClaimsFilter] = useState('');
  const [claimNotes, setClaimNotes] = useState<Record<string, string>>({});
  const [claimMethod, setClaimMethod] = useState<Record<string, ClaimVerificationMethod>>({});
  const [claimEvidenceOk, setClaimEvidenceOk] = useState<Record<string, boolean>>({});
  const [claimReason, setClaimReason] = useState<Record<string, string>>({});
  const [claimOutcome, setClaimOutcome] = useState<Record<string, string>>({});

  // Lost & Found state
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [lostSearch, setLostSearch] = useState('');
  const [lostStatusFilter, setLostStatusFilter] = useState('');
  const [printMode, setPrintMode] = useState<'all' | 'recovered'>('all');

  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [foundSearch, setFoundSearch] = useState('');
  const [foundStatusFilter, setFoundStatusFilter] = useState('');

  // Moderation / Flagged Reports state
  const [flagReports, setFlagReports] = useState<FlagReport[]>([]);
  const [flagStatusFilter, setFlagStatusFilter] = useState('');
  const [flagReasonFilter, setFlagReasonFilter] = useState('');

  // Overdue & Policy state
  const [overdueData, setOverdueData] = useState<{
    thresholds: { overdueLostDays: number; overdueFoundDays: number; unclaimedPolicyDays: number };
    policySummary: string;
    overdueFound: FoundItem[];
    overdueLost: LostItem[];
  }>({
    thresholds: { overdueLostDays: 30, overdueFoundDays: 30, unclaimedPolicyDays: 60 },
    policySummary: '',
    overdueFound: [],
    overdueLost: []
  });

  // System Reports state
  const [systemReport, setSystemReport] = useState<AdminSystemReport | null>(null);

  // Users & Staff Provisioning state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    studentId: '',
    fullName: '',
    email: '',
    course: '',
    phone: '',
    password: '',
    role: 'admin' as UserRole
  });

  // Locations & Audit state
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState<PaginationMeta>({ page: 1, limit: 15, total: 0, totalPages: 1 });

  const [newLoc, setNewLoc] = useState({
    name: '',
    code: '',
    buildingArea: '',
    isHoldingDesk: false,
    description: ''
  });

  const [loading, setLoading] = useState(true);

  const loadLocations = useCallback(async () => {
    try {
      const res = await locationsApi.list({ includeInactive: true });
      setLocations(res.locations);
    } catch {
      // ignore background preset load error
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const data = await adminApi.dashboard();
      setCounts(data.counts);
      setRecentReturns(data.recentReturns);
      setAwaitingClaims(data.awaitingClaims);
      setRecentActivity(data.recentActivity || []);
      setSuggestedMatches(data.suggestedMatches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load administration metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setError('');
    try {
      if (tab === 'overview') {
        await loadDashboard();
      } else if (tab === 'claims') {
        const res = await claimsApi.list({ status: claimsFilter || undefined, limit: 30 });
        setClaims(res.claims);
      } else if (tab === 'lost') {
        const res = await lostItemsApi.list({
          q: lostSearch.trim() || undefined,
          status: lostStatusFilter || undefined,
          limit: 50
        });
        setLostItems(res.items);
      } else if (tab === 'found') {
        const res = await foundItemsApi.list({
          q: foundSearch.trim() || undefined,
          status: foundStatusFilter || undefined,
          limit: 50
        });
        setFoundItems(res.items);
      } else if (tab === 'moderation') {
        const res = await reportsApi.list({
          status: flagStatusFilter || undefined,
          reason: flagReasonFilter || undefined,
          limit: 50
        });
        setFlagReports(res.reports);
      } else if (tab === 'overdue') {
        const res = await adminApi.overdue();
        setOverdueData(res);
      } else if (tab === 'users') {
        const res = await adminApi.users({
          q: userSearch.trim() || undefined,
          role: userRoleFilter || undefined,
          limit: 50
        });
        setUsers(res.users);
      } else if (tab === 'locations') {
        await loadLocations();
      } else if (tab === 'reports') {
        const res = await adminApi.reports();
        setSystemReport(res);
      } else if (tab === 'audit') {
        const res = await adminApi.auditLogs({
          entityType: auditEntityFilter || undefined,
          q: auditSearch.trim() || undefined,
          page: auditPage,
          limit: 15
        });
        setAuditLogs(res.logs);
        setAuditPagination(res.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load management records.');
    }
  }, [
    tab,
    claimsFilter,
    lostSearch,
    lostStatusFilter,
    foundSearch,
    foundStatusFilter,
    flagStatusFilter,
    flagReasonFilter,
    userSearch,
    userRoleFilter,
    auditEntityFilter,
    auditSearch,
    auditPage,
    loadDashboard,
    loadLocations
  ]);

  useEffect(() => {
    void loadDashboard();
    void loadLocations();
  }, [loadDashboard, loadLocations]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setError('');
    setSuccess('');
    try {
      await pendingAction.run();
      setPendingAction(null);
      await Promise.all([loadDashboard(), loadTabData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      setPendingAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  const requestClaimReview = (claim: Claim, nextStatus: ClaimStatus) => {
    const notes = (claimNotes[claim.id] ?? claim.verificationNotes ?? '').trim();
    const method = claimMethod[claim.id] ?? claim.verificationMethod ?? 'In-Person ID Check';
    const evidenceVerified = claimEvidenceOk[claim.id] ?? Boolean(claim.evidenceVerified);
    const decisionReason = (claimReason[claim.id] ?? claim.decisionReason ?? '').trim();
    const outcome = (claimOutcome[claim.id] ?? claim.outcome ?? '').trim();

    if (notes.length < 3) {
      setError('Please enter verification notes (at least 3 characters) before updating a claim.');
      return;
    }

    setPendingAction({
      title: `Mark claim ${claim.referenceCode} as ${nextStatus}?`,
      message:
        nextStatus === 'Approved'
          ? `Approving via "${method}" will mark "${claim.foundItem?.itemName || 'the found item'}" as Returned, record a Collection custody event, and close other pending claims on this item.`
          : `This will update claim ${claim.referenceCode} to "${nextStatus}" and record your reason, verification method, and outcome in the audit trail.`,
      confirmLabel: `Confirm ${nextStatus}`,
      tone: nextStatus === 'Approved' ? 'success' : nextStatus === 'Rejected' ? 'danger' : 'primary',
      run: async () => {
        await claimsApi.review(claim.id, {
          status: nextStatus,
          verificationNotes: notes,
          verificationMethod: method,
          evidenceVerified: nextStatus === 'Approved' ? true : evidenceVerified,
          decisionReason: decisionReason || undefined,
          outcome: outcome || undefined
        });
        setSuccess(`Claim ${claim.referenceCode} updated to ${nextStatus}.`);
      }
    });
  };

  const requestFlagSuspiciousClaim = (claim: Claim) => {
    setPendingAction({
      title: `Flag claim ${claim.referenceCode} as suspicious?`,
      message: `Create a "Suspicious Claim" moderation report for ${claim.referenceCode} so staff can investigate and document follow-up?`,
      confirmLabel: 'Flag Suspicious Claim',
      tone: 'danger',
      run: async () => {
        await reportsApi.create({
          targetType: 'Claim',
          targetId: claim.id,
          reason: 'Suspicious Claim',
          details: `Flagged from Admin Claim Review queue for ${claim.foundItem?.itemName || 'item'} (claimant: ${claim.claimant?.studentId || 'unknown'}).`
        });
        setSuccess(`Flagged claim ${claim.referenceCode} in Moderation Queue.`);
      }
    });
  };

  const requestLostStatusChange = (item: LostItem, nextStatus: LostItemStatus) => {
    if (item.status === nextStatus) return;
    setPendingAction({
      title: nextStatus === 'Claimed' ? 'Mark lost item as found by owner?' : 'Update lost report status?',
      message: `Change "${item.itemName}" from ${item.status} to ${nextStatus}? This change will be recorded in the audit log.`,
      confirmLabel: nextStatus === 'Claimed' ? 'Mark Found by Owner' : 'Update status',
      tone: nextStatus === 'Claimed' ? 'success' : 'primary',
      run: async () => {
        await lostItemsApi.update(item.id, { status: nextStatus });
        setSuccess(`Lost report "${item.itemName}" marked ${nextStatus}.`);
      }
    });
  };

  const requestListingModeration = (
    kind: 'lost' | 'found',
    item: LostItem | FoundItem,
    nextMod: ListingModerationStatus
  ) => {
    setPendingAction({
      title: `${nextMod === 'Approved' ? 'Approve' : nextMod} ${kind} listing?`,
      message:
        nextMod === 'Hidden'
          ? `Hide "${item.itemName}" from public listings (for example, while redacting sensitive details or investigating a flag)?`
          : nextMod === 'Archived'
            ? `Archive "${item.itemName}" so it is removed from active public browsing while keeping its record?`
            : `Approve "${item.itemName}" for public campus visibility?`,
      confirmLabel: `Set ${nextMod}`,
      tone: nextMod === 'Approved' ? 'success' : 'danger',
      run: async () => {
        if (kind === 'lost') {
          await lostItemsApi.update(item.id, { moderationStatus: nextMod });
        } else {
          await foundItemsApi.update(item.id, {
            moderationStatus: nextMod,
            ...(nextMod === 'Archived' ? { status: 'Archived' } : {})
          });
        }
        setSuccess(`Listing "${item.itemName}" set to ${nextMod}.`);
      }
    });
  };

  const requestDeleteLostItem = (item: LostItem) => {
    setPendingAction({
      title: 'Delete lost-item report?',
      message: `Permanently remove "${item.itemName}" from the system? This action cannot be undone and is recorded in the audit log.`,
      confirmLabel: 'Delete Report',
      tone: 'danger',
      run: async () => {
        await lostItemsApi.remove(item.id);
        setSuccess(`Removed lost report "${item.itemName}".`);
      }
    });
  };

  const requestFoundStatusChange = (item: FoundItem, nextStatus: FoundItemStatus) => {
    if (item.status === nextStatus) return;
    setPendingAction({
      title: nextStatus === 'Returned' ? 'Mark item returned to owner?' : 'Update found item status?',
      message: `Change "${item.itemName}" from ${item.status} to ${nextStatus}? This change will be logged in the audit trail.`,
      confirmLabel: nextStatus === 'Returned' ? 'Mark Returned' : 'Update status',
      tone: nextStatus === 'Archived' ? 'danger' : nextStatus === 'Returned' ? 'success' : 'primary',
      run: async () => {
        await foundItemsApi.update(item.id, { status: nextStatus });
        setSuccess(`Found item "${item.itemName}" marked ${nextStatus}.`);
      }
    });
  };

  const requestDeleteFoundItem = (item: FoundItem) => {
    setPendingAction({
      title: 'Delete found item?',
      message: `Permanently remove "${item.itemName}" from found inventory?`,
      confirmLabel: 'Remove Item',
      tone: 'danger',
      run: async () => {
        try {
          await foundItemsApi.remove(item.id, false);
          setSuccess(`Removed found item "${item.itemName}".`);
        } catch (err) {
          if (err instanceof ApiError && err.code === 'ACTIVE_CLAIMS_EXIST') {
            setPendingAction({
              title: 'Active claims exist — force remove item?',
              message: `"${item.itemName}" still has pending claim(s). Confirming forced removal will close those open claims and permanently delete the item record.`,
              confirmLabel: 'Force Remove Item',
              tone: 'danger',
              run: async () => {
                await foundItemsApi.remove(item.id, true);
                setSuccess(`Force-removed found item "${item.itemName}" and closed open claims.`);
              }
            });
            throw new Error('Item has active claims. Review the confirmation prompt to force remove.');
          }
          throw err;
        }
      }
    });
  };

  const requestUserChange = (target: User, patch: { role?: 'student' | 'admin'; isActive?: boolean }) => {
    const desc =
      patch.role !== undefined
        ? `Change ${target.fullName}'s role to ${patch.role}?`
        : `${patch.isActive ? 'Reactivate' : 'Deactivate'} ${target.fullName}'s account?`;
    setPendingAction({
      title: 'Confirm account update',
      message: desc,
      confirmLabel: 'Save account change',
      tone: patch.isActive === false ? 'danger' : 'primary',
      run: async () => {
        await adminApi.updateUser(target.id, patch);
        setSuccess(`Updated account for ${target.fullName}.`);
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await adminApi.createUser({
        studentId: newUserForm.studentId.trim(),
        fullName: newUserForm.fullName.trim(),
        email: newUserForm.email.trim(),
        course: newUserForm.course.trim(),
        phone: newUserForm.phone.trim(),
        password: newUserForm.password,
        role: newUserForm.role
      });
      setNewUserForm({
        studentId: '',
        fullName: '',
        email: '',
        course: '',
        phone: '',
        password: '',
        role: 'admin'
      });
      setShowAddUser(false);
      setSuccess(`Provisioned ${res.user.role} account for ${res.user.fullName}.`);
      await Promise.all([loadDashboard(), loadTabData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await locationsApi.create({
        name: newLoc.name.trim(),
        code: newLoc.code.trim().toUpperCase(),
        buildingArea: newLoc.buildingArea.trim(),
        isHoldingDesk: newLoc.isHoldingDesk,
        description: newLoc.description.trim()
      });
      setNewLoc({ name: '', code: '', buildingArea: '', isHoldingDesk: false, description: '' });
      setSuccess('Campus location added.');
      await Promise.all([loadDashboard(), loadTabData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add campus location.');
    }
  };

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-header no-print">
          <div>
            <span className="badge badge-green">
              <ShieldCheck size={13} /> System Monitor &amp; Admin Control Center
            </span>
            <h1 style={{ marginTop: 8 }}>Admin Dashboard</h1>
            <p>
              Oversee listings, verify ownership claims, track storage &amp; transfers, manage staff roles,
              handle flagged reports, monitor overdue unclaimed property, and enforce listing privacy.
            </p>
          </div>
          <div className="row-gap">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setItemModal({ open: true, kind: 'found', mode: 'create' })}
            >
              <Upload size={15} /> Upload Found Item
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setItemModal({ open: true, kind: 'lost', mode: 'create' })}
            >
              <Upload size={15} /> Upload Lost Report
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void Promise.all([loadDashboard(), loadTabData()])}
              title="Refresh dashboard data"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>

        <div className="kpi-grid no-print">
          <div className="kpi-card">
            <div className="kpi-icon-circle red">
              <ClipboardList size={22} />
            </div>
            <div>
              <div className="kpi-label">Open Lost Reports</div>
              <div className="kpi-value">{counts.openLostReports}</div>
              <div className="kpi-sub">{counts.overdueLostItems} overdue (&ge;30d)</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-circle">
              <Package size={22} />
            </div>
            <div>
              <div className="kpi-label">Found in Storage</div>
              <div className="kpi-value">{counts.foundItemsInStorage}</div>
              <div className="kpi-sub">
                {counts.foundClaimPending} claim pending · {counts.overdueFoundItems} overdue
              </div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-circle gold">
              <Clock size={22} />
            </div>
            <div>
              <div className="kpi-label">Claims &amp; Flags</div>
              <div className="kpi-value">{counts.claimsAwaitingReview}</div>
              <div className="kpi-sub">
                open claims · {counts.openFlagReports} flag(s)
              </div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-circle emerald">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="kpi-label">Returned Items</div>
              <div className="kpi-value">{counts.recentlyReturnedItems}</div>
              <div className="kpi-sub">{counts.totalReturnedItems} returned overall</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error no-print" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success no-print" role="status">
            {success}
          </div>
        )}

        <div className="tabs no-print" role="tablist">
          {(
            [
              ['overview', 'System Monitor'],
              ['claims', `Claims (${counts.claimsAwaitingReview})`],
              ['lost', 'Lost Listings'],
              ['found', 'Found & Storage'],
              ['moderation', `Flagged Reports (${counts.openFlagReports})`],
              ['overdue', `Overdue & Policy (${counts.overdueFoundItems + counts.overdueLostItems})`],
              ['users', `Users & Roles (${counts.totalStudents + counts.totalStaff})`],
              ['locations', `Desks (${counts.activeLocations})`],
              ['reports', `Reports${counts.privacyWarningCount > 0 ? ` (${counts.privacyWarningCount} PII)` : ''}`],
              ['audit', 'Audit Trail']
            ] as [AdminTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab-btn ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && tab === 'overview' ? (
          <div className="loading-state" role="status">
            Loading dashboard data…
          </div>
        ) : tab === 'overview' ? (
          <div style={{ display: 'grid', gap: 20 }}>
            {(counts.openFlagReports > 0 || counts.policyDueFoundItems > 0 || counts.privacyWarningCount > 0) && (
              <div className="alert alert-warning small">
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                <div className="row-between" style={{ width: '100%', gap: 10 }}>
                  <span>
                    <strong>Admin Attention Needed:</strong>{' '}
                    {counts.openFlagReports > 0 && `${counts.openFlagReports} open flagged report(s). `}
                    {counts.policyDueFoundItems > 0 && `${counts.policyDueFoundItems} unclaimed item(s) past 60-day policy threshold. `}
                    {counts.privacyWarningCount > 0 && `${counts.privacyWarningCount} public listing(s) may contain sensitive info.`}
                  </span>
                  <div className="row-gap">
                    {counts.openFlagReports > 0 && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('moderation')}>
                        Review Flags
                      </button>
                    )}
                    {counts.policyDueFoundItems > 0 && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('overdue')}>
                        Overdue Policy
                      </button>
                    )}
                    {counts.privacyWarningCount > 0 && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('reports')}>
                        Privacy Audit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="dashboard-split">
              <div className="card">
                <div className="row-between">
                  <h2 style={{ margin: 0, fontSize: '1.08rem' }}>Campus Recovery Statistics</h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('reports')}>
                    Full System Report
                  </button>
                </div>
                {(() => {
                  const total = Math.max(
                    1,
                    counts.openLostReports +
                      counts.foundItemsInStorage +
                      counts.foundClaimPending +
                      counts.totalReturnedItems
                  );
                  return (
                    <>
                      <div className="stat-progress-track" aria-label="Campus recovery distribution">
                        <div
                          className="stat-seg-blue"
                          style={{ width: `${(counts.foundItemsInStorage / total) * 100}%` }}
                          title="Found in Storage"
                        />
                        <div
                          className="stat-seg-gold"
                          style={{ width: `${(counts.foundClaimPending / total) * 100}%` }}
                          title="Claim Pending"
                        />
                        <div
                          className="stat-seg-emerald"
                          style={{ width: `${(counts.totalReturnedItems / total) * 100}%` }}
                          title="Returned"
                        />
                        <div
                          className="stat-seg-red"
                          style={{ width: `${(counts.openLostReports / total) * 100}%` }}
                          title="Open Lost"
                        />
                      </div>
                      <div className="stat-breakdown-row">
                        <div>
                          <div className="kpi-label">Stored</div>
                          <div className="kpi-value" style={{ fontSize: '1.35rem' }}>
                            {counts.foundItemsInStorage}
                          </div>
                        </div>
                        <div>
                          <div className="kpi-label">Claim Pending</div>
                          <div className="kpi-value" style={{ fontSize: '1.35rem' }}>
                            {counts.foundClaimPending}
                          </div>
                        </div>
                        <div>
                          <div className="kpi-label">Returned</div>
                          <div className="kpi-value" style={{ fontSize: '1.35rem' }}>
                            {counts.totalReturnedItems}
                          </div>
                        </div>
                        <div>
                          <div className="kpi-label">Open Lost</div>
                          <div className="kpi-value" style={{ fontSize: '1.35rem' }}>
                            {counts.openLostReports}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="action-banner-card">
                <span className="badge" style={{ background: 'rgba(245,183,0,0.22)', color: '#fff6d6' }}>
                  ADMIN OPERATIONS
                </span>
                <h3>Oversight &amp; custody controls</h3>
                <p>
                  Approve or archive listings, track storage bins &amp; desk transfers, verify ownership claims,
                  and enforce university unclaimed-property policy.
                </p>
                <div className="row-gap">
                  <button
                    type="button"
                    className="btn btn-white btn-sm"
                    onClick={() => setItemModal({ open: true, kind: 'found', mode: 'create' })}
                  >
                    <Upload size={15} /> Log Found Item
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost-light btn-sm"
                    onClick={() => setTab('claims')}
                  >
                    Claims ({counts.claimsAwaitingReview})
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost-light btn-sm"
                    onClick={() => setTab('overdue')}
                  >
                    Overdue ({counts.overdueFoundItems})
                  </button>
                </div>
              </div>
            </div>

            <div className="two-col">
              <div className="card">
                <div className="row-between" style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Claims Awaiting Review</h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('claims')}>
                    Review Queue
                  </button>
                </div>
                {awaitingClaims.length === 0 ? (
                  <p className="muted small">All ownership claims have been processed.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {awaitingClaims.map((claim) => (
                      <div key={claim.id} className="card card-compact">
                        <div className="row-between">
                          <strong>
                            {claim.referenceCode} — {claim.foundItem?.itemName}
                          </strong>
                          <StatusBadge status={claim.status} />
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Claimant: {claim.claimant?.fullName} ({claim.claimant?.studentId}) ·{' '}
                          {formatDate(claim.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="row-between" style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={18} color="#157347" /> Live System Activity Monitor
                  </h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('audit')}>
                    Full Audit Log
                  </button>
                </div>
                {recentActivity.length === 0 ? (
                  <p className="muted small">No recent system activity logged.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recentActivity.slice(0, 6).map((log) => (
                      <div key={log.id} className="card card-compact" style={{ padding: 12 }}>
                        <div className="row-between">
                          <span className="badge badge-slate">{log.action}</span>
                          <span className="muted small">{formatDateTime(log.createdAt)}</span>
                        </div>
                        <div className="small" style={{ marginTop: 6 }}>
                          {log.summary}
                        </div>
                        <div className="muted small" style={{ marginTop: 2 }}>
                          By {log.actor?.fullName || 'System'} ({log.actorRole})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="two-col">
              <div className="card">
                <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.1rem' }}>Recently Returned Items</h2>
                {recentReturns.length === 0 ? (
                  <p className="muted small">No returned items recorded yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recentReturns.map((item) => (
                      <div key={item.id} className="card card-compact">
                        <div className="row-between">
                          <strong>{item.itemName}</strong>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          {item.category} · Returned {formatDate(item.collectedAt || item.updatedAt)}
                          {item.collectedByName ? ` to ${item.collectedByName}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="row-gap" style={{ marginBottom: 10 }}>
                  <Sparkles size={18} color="#1d63dc" />
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Suggested Lost / Found Matches</h2>
                </div>
                {suggestedMatches && (
                  <div className="alert alert-warning small">{suggestedMatches.disclaimer}</div>
                )}
                {!suggestedMatches || suggestedMatches.matches.length === 0 ? (
                  <p className="muted small">No high-confidence cross-matches currently detected.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {suggestedMatches.matches.map((pair, idx) => (
                      <div key={`${pair.lostItem.id}-${pair.foundItem.id}-${idx}`} className="card card-compact">
                        <div className="row-between">
                          <span className="badge badge-purple">{pair.score}% match</span>
                          <span className="muted small">{pair.reasons.join(' · ')}</span>
                        </div>
                        <div className="small" style={{ marginTop: 6 }}>
                          <strong>Lost:</strong>{' '}
                          <Link to={`/lost/${pair.lostItem.id}`} style={{ color: '#1d63dc' }}>
                            {pair.lostItem.itemName}
                          </Link>
                          <br />
                          <strong>Found:</strong>{' '}
                          <Link to={`/found/${pair.foundItem.id}`} style={{ color: '#1d63dc' }}>
                            {pair.foundItem.itemName}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : tab === 'claims' ? (
          <div>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div className="field" style={{ maxWidth: 240 }}>
                <label htmlFor="admin-claim-filter">Filter by claim status</label>
                <select
                  id="admin-claim-filter"
                  value={claimsFilter}
                  onChange={(e) => setClaimsFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {CLAIM_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {claims.length === 0 ? (
              <div className="empty-state">No ownership claims match this filter.</div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {claims.map((claim) => (
                  <div key={claim.id} className="card">
                    <div className="row-between" style={{ marginBottom: 12 }}>
                      <div className="row-gap">
                        <span className="badge badge-slate">{claim.referenceCode}</span>
                        <strong style={{ fontSize: '1.05rem' }}>
                          {claim.foundItem?.itemName || 'Found Item'}
                        </strong>
                        {claim.evidenceVerified && (
                          <span className="badge badge-green">
                            <CheckCircle2 size={12} /> Evidence Verified
                          </span>
                        )}
                      </div>
                      <StatusBadge status={claim.status} />
                    </div>

                    <div className="two-col" style={{ marginBottom: 14 }}>
                      <div className="card card-compact" style={{ background: '#f8fafc' }}>
                        <div className="muted small">
                          <strong>Claimant Submission</strong>
                        </div>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Student:</strong> {claim.claimant?.fullName} ({claim.claimant?.studentId}) ·{' '}
                          {claim.claimant?.email} · {claim.claimant?.phone}
                        </p>
                        {claim.claimant?.phone && (
                          <div style={{ marginBottom: 8 }}>
                            <a
                              href={
                                buildWhatsAppLink(
                                  claim.claimant.phone,
                                  `Hello ${claim.claimant.fullName || 'Student'}, this is Bugema University Lost & Found staff regarding your claim ${claim.referenceCode} (${claim.foundItem?.itemName || 'campus item'}).`
                                ) || '#'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-whatsapp btn-sm"
                            >
                              <MessageCircle size={14} /> WhatsApp Claimant
                            </a>
                          </div>
                        )}
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Explanation:</strong> {claim.explanation}
                        </p>
                        <p className="small" style={{ margin: '6px 0 0' }}>
                          <strong>Ownership Proof:</strong> {claim.identifyingProof}
                        </p>
                      </div>

                      <div className="card card-compact" style={{ background: '#fefce8' }}>
                        <div className="muted small">
                          <strong>Stored Found Item (Staff-Only Intake Record)</strong>
                        </div>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Holding Location:</strong> {claim.foundItem?.holdingLocation}
                          {claim.foundItem?.storageBin ? ` (${claim.foundItem.storageBin})` : ''} (Status:{' '}
                          {claim.foundItem?.status})
                        </p>
                        <p className="small" style={{ margin: '6px 0' }}>
                          <strong>Public Summary:</strong> {claim.foundItem?.description}
                        </p>
                        <p className="small" style={{ margin: '6px 0 0' }}>
                          <strong>Private Identifying Details:</strong>{' '}
                          {claim.foundItem?.identifyingDetails || 'Not recorded'}
                        </p>
                      </div>
                    </div>

                    {claim.reviewedBy && (
                      <p className="muted small" style={{ marginBottom: 10 }}>
                        Last reviewed by <strong>{claim.reviewedBy.fullName}</strong> on{' '}
                        {formatDateTime(claim.reviewedAt)}
                        {claim.verificationMethod ? ` · Method: ${claim.verificationMethod}` : ''}
                        {claim.outcome ? ` · Outcome: ${claim.outcome}` : ''}
                      </p>
                    )}

                    <div className="form-grid" style={{ marginBottom: 12 }}>
                      <div className="field">
                        <label htmlFor={`method-${claim.id}`}>Verification process / method</label>
                        <select
                          id={`method-${claim.id}`}
                          value={claimMethod[claim.id] ?? claim.verificationMethod ?? 'In-Person ID Check'}
                          onChange={(e) =>
                            setClaimMethod({ ...claimMethod, [claim.id]: e.target.value as ClaimVerificationMethod })
                          }
                        >
                          {CLAIM_VERIFICATION_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field" style={{ justifyContent: 'flex-end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 18 }}>
                          <input
                            type="checkbox"
                            checked={claimEvidenceOk[claim.id] ?? Boolean(claim.evidenceVerified)}
                            onChange={(e) =>
                              setClaimEvidenceOk({ ...claimEvidenceOk, [claim.id]: e.target.checked })
                            }
                          />
                          <span>Evidence &amp; student ID verified in person / approved process</span>
                        </label>
                      </div>

                      <div className="field">
                        <label htmlFor={`reason-${claim.id}`}>Decision reason</label>
                        <input
                          id={`reason-${claim.id}`}
                          value={claimReason[claim.id] ?? claim.decisionReason ?? ''}
                          onChange={(e) => setClaimReason({ ...claimReason, [claim.id]: e.target.value })}
                          placeholder="e.g. Serial number & student ID matched / Proof did not match"
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`outcome-${claim.id}`}>Recorded outcome</label>
                        <input
                          id={`outcome-${claim.id}`}
                          value={claimOutcome[claim.id] ?? claim.outcome ?? ''}
                          onChange={(e) => setClaimOutcome({ ...claimOutcome, [claim.id]: e.target.value })}
                          placeholder="e.g. Released to owner at Main Gate Desk / Kept in storage"
                        />
                      </div>

                      <div className="field form-full">
                        <label htmlFor={`notes-${claim.id}`}>Staff verification notes *</label>
                        <textarea
                          id={`notes-${claim.id}`}
                          style={{ minHeight: 68 }}
                          value={claimNotes[claim.id] ?? claim.verificationNotes ?? ''}
                          onChange={(e) => setClaimNotes({ ...claimNotes, [claim.id]: e.target.value })}
                          placeholder="Record ID check details, matching marks confirmed, or reason for rejection"
                        />
                      </div>
                    </div>

                    <div className="row-gap">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => requestClaimReview(claim, 'Under Review')}
                      >
                        Mark Under Review
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => requestClaimReview(claim, 'Approved')}
                        disabled={claim.status === 'Approved'}
                      >
                        Approve &amp; Record Release
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => requestClaimReview(claim, 'Rejected')}
                        disabled={claim.status === 'Rejected'}
                      >
                        Reject Claim
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => requestFlagSuspiciousClaim(claim)}
                      >
                        <Flag size={14} /> Flag Suspicious
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'lost' ? (
          <div>
            <div className="row-between no-print" style={{ marginBottom: 14 }}>
              <div className="row-gap">
                <input
                  type="search"
                  aria-label="Search lost reports"
                  placeholder="Search lost items…"
                  value={lostSearch}
                  onChange={(e) => setLostSearch(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
                />
                <select
                  aria-label="Filter lost reports by status"
                  value={lostStatusFilter}
                  onChange={(e) => setLostStatusFilter(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
                >
                  <option value="">All statuses (incl. Recovered)</option>
                  {LOST_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st === 'Claimed' ? 'Claimed (Recovered)' : st}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`btn btn-sm ${lostStatusFilter === 'Claimed' ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => setLostStatusFilter((prev) => (prev === 'Claimed' ? '' : 'Claimed'))}
                >
                  <CheckCircle2 size={14} /> Recovered Only ({lostItems.filter((i) => i.status === 'Claimed').length})
                </button>
              </div>
              <div className="row-gap">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPrintMode('all');
                    window.setTimeout(() => window.print(), 60);
                  }}
                >
                  <Printer size={15} /> Print All Lost &amp; Recovered
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPrintMode('recovered');
                    window.setTimeout(() => window.print(), 60);
                  }}
                >
                  <Printer size={15} /> Print Recovered Only
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setItemModal({ open: true, kind: 'lost', mode: 'create' })}
                >
                  <Upload size={15} /> Upload Lost Report
                </button>
              </div>
            </div>

            {lostItems.length === 0 ? (
              <div className="empty-state no-print">No lost-item reports match your filter.</div>
            ) : (
              <div className="table-wrap no-print">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>Item &amp; Privacy Check</th>
                      <th>Owner &amp; Direct Contact</th>
                      <th>Location / Date</th>
                      <th>Status &amp; Visibility</th>
                      <th>Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lostItems.map((item) => {
                      const waUrl = buildWhatsAppLink(
                        item.owner?.phone,
                        `Hello ${item.owner?.fullName || 'Student'}, this is Bugema University Campus Lost & Found staff regarding your lost item report: "${item.itemName}".`
                      );
                      const mod = item.moderationStatus || 'Approved';
                      return (
                        <tr key={item.id}>
                          <td data-label="Item & Privacy Check">
                            <Link to={`/lost/${item.id}`} style={{ fontWeight: 700, color: '#0e4d9c' }}>
                              {item.itemName}
                            </Link>
                            <div className="muted small">{item.category}</div>
                            {item.identifyingDetails && (
                              <div className="small" style={{ marginTop: 4 }}>
                                <em>Private:</em> {item.identifyingDetails}
                              </div>
                            )}
                            {item.privacyWarnings && item.privacyWarnings.length > 0 && (
                              <div className="badge badge-red" style={{ marginTop: 6 }}>
                                <ShieldAlert size={12} /> {item.privacyWarnings[0]}
                              </div>
                            )}
                          </td>
                          <td data-label="Owner & Direct Contact" className="small">
                            <strong>{item.owner?.fullName || 'Unknown'}</strong>
                            <div className="muted">{item.owner?.studentId}</div>
                            {item.owner?.email && <div>{item.owner.email}</div>}
                            {item.owner?.phone && <div>{item.owner.phone}</div>}
                            {waUrl && (
                              <div style={{ marginTop: 6 }}>
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-whatsapp btn-sm"
                                >
                                  <MessageCircle size={14} /> WhatsApp
                                </a>
                              </div>
                            )}
                          </td>
                          <td data-label="Location / Date" className="small">
                            {item.lastKnownLocation}
                            <div className="muted">{formatDate(item.dateLost)}</div>
                          </td>
                          <td data-label="Status & Visibility">
                            <div className="row-gap" style={{ marginBottom: 6 }}>
                              <StatusBadge status={item.status} />
                              <span
                                className={`badge ${
                                  mod === 'Approved' ? 'badge-green' : mod === 'Hidden' ? 'badge-red' : 'badge-slate'
                                }`}
                              >
                                {mod}
                              </span>
                            </div>
                            <select
                              aria-label={`Change status for ${item.itemName}`}
                              value={item.status}
                              onChange={(e) =>
                                requestLostStatusChange(item, e.target.value as LostItemStatus)
                              }
                            >
                              {LOST_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td data-label="Admin Actions">
                            <div className="row-gap">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  setItemModal({ open: true, kind: 'lost', mode: 'edit', lostItem: item })
                                }
                              >
                                <Pencil size={14} /> Edit / Redact
                              </button>
                              {mod !== 'Approved' ? (
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() => requestListingModeration('lost', item, 'Approved')}
                                >
                                  <Eye size={14} /> Approve
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => requestListingModeration('lost', item, 'Hidden')}
                                >
                                  <EyeOff size={14} /> Hide
                                </button>
                              )}
                              {mod !== 'Archived' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => requestListingModeration('lost', item, 'Archived')}
                                >
                                  <Archive size={14} /> Archive
                                </button>
                              )}
                              {item.status !== 'Claimed' && (
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() => requestLostStatusChange(item, 'Claimed')}
                                >
                                  <CheckCircle2 size={14} /> Recovered
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => requestDeleteLostItem(item)}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dedicated Print-Formatted Report Sheet (visible on window.print()) */}
            <div className="print-report-sheet" aria-hidden="true">
              <div className="print-header">
                <img src="/bugema-logo.jpg" alt="Bugema University Crest" style={{ width: 64, height: 64 }} />
                <div>
                  <h1 style={{ margin: 0, fontSize: '18pt' }}>
                    Bugema University Campus Lost &amp; Found —{' '}
                    {printMode === 'recovered' ? 'Recovered Items Report' : 'Lost & Recovered Items Register'}
                  </h1>
                  <p style={{ margin: '4px 0 0', fontSize: '9.5pt', color: '#475569' }}>
                    Printed on {formatDateTime(new Date().toISOString())} · Authorized Staff Copy (Contains Student Contact Details)
                  </p>
                </div>
              </div>

              {(() => {
                const rows =
                  printMode === 'recovered'
                    ? lostItems.filter((i) => i.status === 'Claimed')
                    : lostItems;
                const recoveredCount = rows.filter((i) => i.status === 'Claimed').length;
                const openCount = rows.filter((i) => i.status === 'Missing' || i.status === 'Matched').length;
                return (
                  <>
                    <div className="print-summary-bar">
                      <span><strong>Records Listed:</strong> {rows.length}</span>
                      <span><strong>Recovered (Claimed):</strong> {recoveredCount}</span>
                      <span><strong>Open (Missing/Matched):</strong> {openCount}</span>
                    </div>
                    <table className="print-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item &amp; Category</th>
                          <th>Recovery Status</th>
                          <th>Last-Known Location &amp; Date</th>
                          <th>Owner &amp; Student ID</th>
                          <th>Contact &amp; WhatsApp Direct</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item, idx) => {
                          const waUrl = buildWhatsAppLink(item.owner?.phone);
                          return (
                            <tr key={item.id}>
                              <td>{idx + 1}</td>
                              <td>
                                <strong>{item.itemName}</strong>
                                <div>{item.category}</div>
                              </td>
                              <td>
                                <strong>{item.status === 'Claimed' ? 'RECOVERED (Claimed)' : item.status}</strong>
                              </td>
                              <td>
                                {item.lastKnownLocation}
                                <div>{formatDate(item.dateLost)}</div>
                              </td>
                              <td>
                                <strong>{item.owner?.fullName || 'N/A'}</strong>
                                <div>{item.owner?.studentId || ''}</div>
                              </td>
                              <td>
                                <div>Phone: {item.owner?.phone || 'N/A'}</div>
                                <div>Email: {item.owner?.email || 'N/A'}</div>
                                {waUrl && <div>WhatsApp: {waUrl}</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                );
              })()}
            </div>
          </div>
        ) : tab === 'found' ? (
          <div>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div className="row-gap">
                <input
                  type="search"
                  aria-label="Search found items"
                  placeholder="Search found items…"
                  value={foundSearch}
                  onChange={(e) => setFoundSearch(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
                />
                <select
                  aria-label="Filter found items by status"
                  value={foundStatusFilter}
                  onChange={(e) => setFoundStatusFilter(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
                >
                  <option value="">All statuses</option>
                  {FOUND_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setItemModal({ open: true, kind: 'found', mode: 'create' })}
              >
                <Upload size={15} /> Upload Found Item
              </button>
            </div>

            {foundItems.length === 0 ? (
              <div className="empty-state">No found items match your filter.</div>
            ) : (
              <div className="table-wrap">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>Item &amp; Private Marks</th>
                      <th>Storage Desk, Bin &amp; Custody</th>
                      <th>Date Found</th>
                      <th>Status &amp; Visibility</th>
                      <th>Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foundItems.map((item) => {
                      const mod = item.moderationStatus || 'Approved';
                      return (
                        <tr key={item.id}>
                          <td data-label="Item & Private Marks">
                            <Link to={`/found/${item.id}`} style={{ fontWeight: 700, color: '#0e4d9c' }}>
                              {item.itemName}
                            </Link>
                            <div className="muted small">{item.category}</div>
                            {item.identifyingDetails && (
                              <div className="small" style={{ marginTop: 4 }}>
                                <em>Private:</em> {item.identifyingDetails}
                              </div>
                            )}
                            {item.privacyWarnings && item.privacyWarnings.length > 0 && (
                              <div className="badge badge-red" style={{ marginTop: 6 }}>
                                <ShieldAlert size={12} /> {item.privacyWarnings[0]}
                              </div>
                            )}
                          </td>
                          <td data-label="Storage Desk, Bin & Custody" className="small">
                            <div><strong>Desk:</strong> {item.holdingLocation}</div>
                            {item.storageBin && <div className="muted">Bin/Shelf: {item.storageBin}</div>}
                            <div className="muted">Found at: {item.locationFound}</div>
                            {item.collectedAt && (
                              <div style={{ color: '#157347', marginTop: 3 }}>
                                Collected {formatDate(item.collectedAt)}
                                {item.collectedByName ? ` by ${item.collectedByName}` : ''}
                              </div>
                            )}
                          </td>
                          <td data-label="Date Found" className="small">{formatDate(item.dateFound)}</td>
                          <td data-label="Status & Visibility">
                            <div className="row-gap" style={{ marginBottom: 6 }}>
                              <StatusBadge status={item.status} />
                              <span
                                className={`badge ${
                                  mod === 'Approved' ? 'badge-green' : mod === 'Hidden' ? 'badge-red' : 'badge-slate'
                                }`}
                              >
                                {mod}
                              </span>
                            </div>
                            <select
                              aria-label={`Change status for ${item.itemName}`}
                              value={item.status}
                              onChange={(e) =>
                                requestFoundStatusChange(item, e.target.value as FoundItemStatus)
                              }
                            >
                              {FOUND_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td data-label="Admin Actions">
                            <div className="row-gap">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setCustodyItem(item)}
                              >
                                <Warehouse size={14} /> Storage / Transfer ({item.custodyHistory?.length || 0})
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  setItemModal({ open: true, kind: 'found', mode: 'edit', foundItem: item })
                                }
                              >
                                <Pencil size={14} /> Edit
                              </button>
                              {mod !== 'Approved' ? (
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() => requestListingModeration('found', item, 'Approved')}
                                >
                                  <Eye size={14} /> Approve
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => requestListingModeration('found', item, 'Hidden')}
                                >
                                  <EyeOff size={14} /> Hide
                                </button>
                              )}
                              {item.status !== 'Archived' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => requestFoundStatusChange(item, 'Archived')}
                                >
                                  <Archive size={14} /> Archive
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => requestDeleteFoundItem(item)}
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === 'moderation' ? (
          <AdminModerationTab
            reports={flagReports}
            statusFilter={flagStatusFilter}
            reasonFilter={flagReasonFilter}
            onStatusFilterChange={setFlagStatusFilter}
            onReasonFilterChange={setFlagReasonFilter}
            onActionSuccess={(msg) => {
              setSuccess(msg);
              void Promise.all([loadDashboard(), loadTabData()]);
            }}
            onActionError={setError}
          />
        ) : tab === 'overdue' ? (
          <AdminOverdueTab
            policySummary={overdueData.policySummary}
            thresholds={overdueData.thresholds}
            overdueFound={overdueData.overdueFound}
            overdueLost={overdueData.overdueLost}
            onActionSuccess={(msg) => {
              setSuccess(msg);
              void Promise.all([loadDashboard(), loadTabData()]);
            }}
            onActionError={setError}
          />
        ) : tab === 'users' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="row-between">
              <div className="row-gap">
                <input
                  type="search"
                  aria-label="Search users"
                  placeholder="Search name, email, ID, department…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
                />
                <select
                  aria-label="Filter users by role"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
                >
                  <option value="">All roles</option>
                  <option value="admin">Authorized Staff / Admin</option>
                  <option value="student">Students</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddUser((prev) => !prev)}
              >
                <UserPlus size={15} /> {showAddUser ? 'Close Form' : 'Add Staff / User Account'}
              </button>
            </div>

            {showAddUser && (
              <div className="card">
                <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Provision Authorized Staff or Student Account</h2>
                <form onSubmit={handleCreateUser} className="form-grid">
                  <div className="field">
                    <label htmlFor="nu-id">Staff / Student ID *</label>
                    <input
                      id="nu-id"
                      required
                      value={newUserForm.studentId}
                      onChange={(e) => setNewUserForm({ ...newUserForm, studentId: e.target.value })}
                      placeholder="e.g. BU-STF-009"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="nu-name">Full name *</label>
                    <input
                      id="nu-name"
                      required
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                      placeholder="Staff officer name"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="nu-email">University email *</label>
                    <input
                      id="nu-email"
                      type="email"
                      required
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      placeholder="officer@example.edu"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="nu-course">Department / Course *</label>
                    <input
                      id="nu-course"
                      required
                      value={newUserForm.course}
                      onChange={(e) => setNewUserForm({ ...newUserForm, course: e.target.value })}
                      placeholder="e.g. Campus Security Desk"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="nu-phone">Phone number *</label>
                    <input
                      id="nu-phone"
                      required
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      placeholder="+256-700-000109"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="nu-role">Assigned role *</label>
                    <select
                      id="nu-role"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                    >
                      <option value="admin">Authorized Staff (Admin)</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
                  <div className="field form-full">
                    <label htmlFor="nu-pass">Initial password (min 8 characters) *</label>
                    <input
                      id="nu-pass"
                      type="password"
                      required
                      minLength={8}
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    />
                  </div>
                  <div className="form-full">
                    <button type="submit" className="btn btn-primary btn-sm">
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Name &amp; Email</th>
                    <th>Student / Staff ID</th>
                    <th>Course / Dept</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Name & Email">
                        <strong>{u.fullName}</strong>
                        <div className="muted small">{u.email}</div>
                      </td>
                      <td data-label="Student / Staff ID" className="small">{u.studentId}</td>
                      <td data-label="Course / Dept" className="small">{u.course}</td>
                      <td data-label="Role">
                        <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                          {u.role === 'admin' ? 'Staff / Admin' : 'Student'}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="row-gap">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              requestUserChange(u, { role: u.role === 'admin' ? 'student' : 'admin' })
                            }
                          >
                            Assign {u.role === 'admin' ? 'Student' : 'Staff Role'}
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => requestUserChange(u, { isActive: !u.isActive })}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'locations' ? (
          <div className="two-col">
            <div className="card">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Add Campus Location</h2>
              <form onSubmit={handleCreateLocation} style={{ display: 'grid', gap: 12 }}>
                <div className="field">
                  <label htmlFor="loc-name">Location name *</label>
                  <input
                    id="loc-name"
                    required
                    value={newLoc.name}
                    onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                    placeholder="e.g. Sports Pavilion Desk"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc-code">Short code *</label>
                  <input
                    id="loc-code"
                    required
                    value={newLoc.code}
                    onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                    placeholder="e.g. SPT-01"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc-area">Campus area / zone *</label>
                  <input
                    id="loc-area"
                    required
                    value={newLoc.buildingArea}
                    onChange={(e) => setNewLoc({ ...newLoc, buildingArea: e.target.value })}
                    placeholder="e.g. South Campus"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc-desc">Description</label>
                  <input
                    id="loc-desc"
                    value={newLoc.description}
                    onChange={(e) => setNewLoc({ ...newLoc, description: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={newLoc.isHoldingDesk}
                    onChange={(e) => setNewLoc({ ...newLoc, isHoldingDesk: e.target.checked })}
                  />
                  Authorized holding desk for storing found items
                </label>
                <button type="submit" className="btn btn-primary">
                  Add Location
                </button>
              </form>
            </div>

            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Holding Desk</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id}>
                      <td data-label="Location">
                        <strong>{loc.name}</strong> ({loc.code})
                        <div className="muted small">{loc.buildingArea}</div>
                      </td>
                      <td data-label="Holding Desk">
                        <span className={`badge ${loc.isHoldingDesk ? 'badge-blue' : 'badge-slate'}`}>
                          {loc.isHoldingDesk ? 'Holding Desk' : 'Area Only'}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${loc.isActive ? 'badge-green' : 'badge-red'}`}>
                          {loc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setPendingAction({
                              title: `${loc.isActive ? 'Deactivate' : 'Activate'} location?`,
                              message: `${loc.isActive ? 'Hide' : 'Restore'} "${loc.name}" in campus location selectors?`,
                              confirmLabel: 'Confirm',
                              tone: loc.isActive ? 'danger' : 'success',
                              run: async () => {
                                await locationsApi.update(loc.id, { isActive: !loc.isActive });
                                setSuccess(`Updated location "${loc.name}".`);
                              }
                            })
                          }
                        >
                          {loc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'reports' ? (
          <AdminReportsTab report={systemReport} onRefresh={() => void loadTabData()} />
        ) : (
          <div>
            <div className="row-gap" style={{ marginBottom: 14 }}>
              <input
                type="search"
                aria-label="Search audit logs"
                placeholder="Search action or summary…"
                value={auditSearch}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditSearch(e.target.value);
                }}
                style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
              />
              <select
                aria-label="Filter audit logs by entity type"
                value={auditEntityFilter}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditEntityFilter(e.target.value);
                }}
                style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(14,77,156,0.18)', background: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All entity types</option>
                {AUDIT_ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td data-label="Timestamp" className="small">{formatDateTime(log.createdAt)}</td>
                      <td data-label="Actor" className="small">
                        {log.actor?.fullName || 'System'}
                        <div className="muted">{log.actorRole}</div>
                      </td>
                      <td data-label="Action">
                        <span className="badge badge-slate">{log.action}</span>
                      </td>
                      <td data-label="Entity" className="small">{log.entityType}</td>
                      <td data-label="Summary" className="small">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={auditPagination} onPageChange={setAuditPage} />
          </div>
        )}

        <AdminItemModal
          open={itemModal.open}
          kind={itemModal.kind}
          mode={itemModal.mode}
          initialLost={itemModal.lostItem}
          initialFound={itemModal.foundItem}
          locations={locations}
          onClose={() => setItemModal((prev) => ({ ...prev, open: false }))}
          onSaved={(msg) => {
            setSuccess(msg);
            void Promise.all([loadDashboard(), loadTabData()]);
          }}
        />

        <AdminCustodyModal
          open={Boolean(custodyItem)}
          item={custodyItem}
          locations={locations}
          onClose={() => setCustodyItem(null)}
          onSaved={(msg) => {
            setSuccess(msg);
            void Promise.all([loadDashboard(), loadTabData()]);
          }}
        />

        <ConfirmDialog
          open={Boolean(pendingAction)}
          title={pendingAction?.title || ''}
          message={pendingAction?.message || ''}
          confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
          tone={pendingAction?.tone || 'primary'}
          busy={actionBusy}
          onConfirm={executeConfirmedAction}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    </section>
  );
}
