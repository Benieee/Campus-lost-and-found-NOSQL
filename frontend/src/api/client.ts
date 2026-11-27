import type {
  AdminMatchPair,
  AdminSystemReport,
  AssistantReply,
  AuditLogEntry,
  CampusLocation,
  Claim,
  ClaimStatus,
  ClaimVerificationMethod,
  CustodyEventType,
  FlagReport,
  FlagReportReason,
  FlagReportStatus,
  FlagReportTarget,
  FoundItem,
  LostItem,
  PaginationMeta,
  SuggestedMatchesResponse,
  UnclaimedPolicyAction,
  User,
  UserRole
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, string[]>;

  constructor(status: number, message: string, code?: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function resolveMediaUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...(options.headers as Record<string, string> | undefined) }
    : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) };

  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    credentials: 'include',
    headers
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : { error: await response.text() };

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error || `Request failed (${response.status}).`,
      data?.code,
      data?.details
    );
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') {
      sp.set(key, String(val));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const publicApi = {
  summary: () =>
    request<{
      counts: { openLostReports: number; foundInStorage: number; returnedItems: number };
      projectNotice: string;
    }>('/public/summary')
};

export const authApi = {
  me: () => request<{ user: User | null }>('/auth/me'),
  login: (payload: { email: string; password: string }) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload: {
    studentId: string;
    fullName: string;
    email: string;
    course: string;
    phone: string;
    password: string;
  }) => request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  updateProfile: (payload: { fullName?: string; course?: string; phone?: string }) =>
    request<{ user: User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) })
};

export const uploadsApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return request<{ imageUrl: string }>('/uploads/image', {
      method: 'POST',
      body: formData
    });
  }
};

export const locationsApi = {
  list: (params: { includeInactive?: boolean; holdingOnly?: boolean } = {}) =>
    request<{ locations: CampusLocation[] }>(`/locations${toQuery(params)}`),
  create: (payload: {
    name: string;
    code: string;
    buildingArea: string;
    isHoldingDesk: boolean;
    description?: string;
  }) => request<{ location: CampusLocation }>('/locations', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CampusLocation>) =>
    request<{ location: CampusLocation }>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void | { deactivated: boolean; message: string }>(`/locations/${id}`, { method: 'DELETE' })
};

export const lostItemsApi = {
  list: (
    params: {
      q?: string;
      category?: string;
      location?: string;
      status?: string;
      moderationStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      mine?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) => request<{ items: LostItem[]; pagination: PaginationMeta }>(`/lost-items${toQuery(params)}`),
  getById: (id: string) =>
    request<{ item: LostItem; suggestedMatches: SuggestedMatchesResponse<FoundItem> }>(`/lost-items/${id}`),
  create: (payload: Record<string, unknown>) =>
    request<{ item: LostItem }>('/lost-items', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    request<{ item: LostItem }>(`/lost-items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/lost-items/${id}`, { method: 'DELETE' })
};

export const foundItemsApi = {
  list: (
    params: {
      q?: string;
      category?: string;
      location?: string;
      status?: string;
      moderationStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      mine?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) => request<{ items: FoundItem[]; pagination: PaginationMeta }>(`/found-items${toQuery(params)}`),
  getById: (id: string) =>
    request<{ item: FoundItem; suggestedMatches: SuggestedMatchesResponse<LostItem> }>(`/found-items/${id}`),
  create: (payload: Record<string, unknown>) =>
    request<{ item: FoundItem }>('/found-items', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    request<{ item: FoundItem }>(`/found-items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  logCustody: (
    id: string,
    payload: {
      eventType: CustodyEventType;
      location: string;
      storageBin?: string;
      recipientName?: string;
      recipientId?: string;
      notes?: string;
    }
  ) => request<{ item: FoundItem }>(`/found-items/${id}/custody`, { method: 'POST', body: JSON.stringify(payload) }),
  applyUnclaimedPolicy: (
    id: string,
    payload: {
      policyAction: Exclude<UnclaimedPolicyAction, 'None'>;
      policyNotes: string;
      archiveItem?: boolean;
    }
  ) =>
    request<{ item: FoundItem }>(`/found-items/${id}/unclaimed-policy`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  remove: (id: string, force = false) =>
    request<void>(`/found-items/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' })
};

export const claimsApi = {
  list: (params: { status?: string; q?: string; page?: number; limit?: number } = {}) =>
    request<{ claims: Claim[]; pagination: PaginationMeta }>(`/claims${toQuery(params)}`),
  getById: (id: string) => request<{ claim: Claim }>(`/claims/${id}`),
  create: (payload: {
    foundItemId: string;
    linkedLostItemId?: string;
    explanation: string;
    identifyingProof: string;
  }) => request<{ claim: Claim }>('/claims', { method: 'POST', body: JSON.stringify(payload) }),
  review: (
    id: string,
    payload: {
      status: ClaimStatus;
      verificationNotes: string;
      verificationMethod?: ClaimVerificationMethod;
      evidenceVerified?: boolean;
      decisionReason?: string;
      outcome?: string;
    }
  ) => request<{ claim: Claim }>(`/claims/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) })
};

export const reportsApi = {
  create: (payload: {
    targetType: FlagReportTarget;
    targetId: string;
    reason: FlagReportReason;
    details: string;
  }) => request<{ report: FlagReport }>('/reports', { method: 'POST', body: JSON.stringify(payload) }),
  list: (params: { status?: string; reason?: string; targetType?: string; page?: number; limit?: number } = {}) =>
    request<{ reports: FlagReport[]; pagination: PaginationMeta }>(`/reports${toQuery(params)}`),
  review: (
    id: string,
    payload: { status: FlagReportStatus; resolutionNotes: string; actionTaken?: string }
  ) => request<{ report: FlagReport }>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
};

export const adminApi = {
  dashboard: () =>
    request<{
      counts: {
        openLostReports: number;
        foundItemsInStorage: number;
        foundClaimPending: number;
        claimsAwaitingReview: number;
        recentlyReturnedItems: number;
        totalReturnedItems: number;
        totalStudents: number;
        totalStaff: number;
        activeLocations: number;
        openFlagReports: number;
        overdueFoundItems: number;
        policyDueFoundItems: number;
        overdueLostItems: number;
        privacyWarningCount: number;
      };
      recentReturns: FoundItem[];
      awaitingClaims: Claim[];
      recentActivity: AuditLogEntry[];
      suggestedMatches: { disclaimer: string; matches: AdminMatchPair[] };
    }>('/admin/dashboard'),
  overdue: () =>
    request<{
      thresholds: { overdueLostDays: number; overdueFoundDays: number; unclaimedPolicyDays: number };
      policySummary: string;
      overdueFound: FoundItem[];
      overdueLost: LostItem[];
    }>('/admin/overdue'),
  reports: () => request<AdminSystemReport>('/admin/reports'),
  users: (params: { q?: string; role?: string; page?: number; limit?: number } = {}) =>
    request<{ users: User[]; pagination: PaginationMeta }>(`/admin/users${toQuery(params)}`),
  createUser: (payload: {
    studentId: string;
    fullName: string;
    email: string;
    course: string;
    phone: string;
    password: string;
    role: UserRole;
  }) => request<{ user: User }>('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: { role?: 'student' | 'admin'; isActive?: boolean; course?: string }) =>
    request<{ user: User }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  auditLogs: (params: { entityType?: string; q?: string; page?: number; limit?: number } = {}) =>
    request<{ logs: AuditLogEntry[]; pagination: PaginationMeta }>(`/admin/audit-logs${toQuery(params)}`)
};

export const assistantApi = {
  status: () =>
    request<{
      available: boolean;
      staffContact: { desk: string; hours: string; guidance: string };
      privacySummary: string;
    }>('/assistant/status'),
  chat: (payload: {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => request<AssistantReply>('/assistant/chat', { method: 'POST', body: JSON.stringify(payload) })
};
