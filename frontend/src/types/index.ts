export type UserRole = 'student' | 'admin';

export const ITEM_CATEGORIES = [
  'Electronics',
  'Documents & ID Cards',
  'Bags & Wallets',
  'Clothing',
  'Books & Stationery',
  'Accessories',
  'Keys',
  'Other'
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export type ContactPreference = 'email' | 'phone' | 'in_app';
export type LostItemStatus = 'Missing' | 'Matched' | 'Claimed' | 'Closed';
export type FoundItemStatus = 'Stored' | 'Claim Pending' | 'Returned' | 'Archived';
export type ClaimStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
export type ListingModerationStatus = 'Approved' | 'Pending Review' | 'Hidden' | 'Archived';
export type ClaimVerificationMethod =
  | 'In-Person ID Check'
  | 'Student ID & Proof Match'
  | 'Serial / Unique Mark Check'
  | 'Department Verification'
  | 'Other';
export type CustodyEventType = 'Stored' | 'Transferred' | 'Collected' | 'Policy Action';
export type UnclaimedPolicyAction =
  | 'None'
  | 'Extended Hold'
  | 'Transferred to University Store'
  | 'Donated'
  | 'Disposed';
export type FlagReportTarget = 'LostItem' | 'FoundItem' | 'Claim';
export type FlagReportReason =
  | 'Inaccurate Listing'
  | 'Duplicate Entry'
  | 'Suspicious Claim'
  | 'Inappropriate Content'
  | 'Privacy Risk'
  | 'Other';
export type FlagReportStatus = 'Open' | 'Investigating' | 'Resolved' | 'Dismissed';

export const LOST_STATUSES: LostItemStatus[] = ['Missing', 'Matched', 'Claimed', 'Closed'];
export const FOUND_STATUSES: FoundItemStatus[] = ['Stored', 'Claim Pending', 'Returned', 'Archived'];
export const CLAIM_STATUSES: ClaimStatus[] = ['Pending', 'Under Review', 'Approved', 'Rejected'];
export const MODERATION_STATUSES: ListingModerationStatus[] = ['Approved', 'Pending Review', 'Hidden', 'Archived'];
export const CLAIM_VERIFICATION_METHODS: ClaimVerificationMethod[] = [
  'In-Person ID Check',
  'Student ID & Proof Match',
  'Serial / Unique Mark Check',
  'Department Verification',
  'Other'
];
export const CUSTODY_EVENT_TYPES: CustodyEventType[] = ['Stored', 'Transferred', 'Collected', 'Policy Action'];
export const UNCLAIMED_POLICY_ACTIONS: UnclaimedPolicyAction[] = [
  'Extended Hold',
  'Transferred to University Store',
  'Donated',
  'Disposed'
];
export const FLAG_REPORT_REASONS: FlagReportReason[] = [
  'Inaccurate Listing',
  'Duplicate Entry',
  'Suspicious Claim',
  'Inappropriate Content',
  'Privacy Risk',
  'Other'
];
export const FLAG_REPORT_STATUSES: FlagReportStatus[] = ['Open', 'Investigating', 'Resolved', 'Dismissed'];
export const AUDIT_ENTITY_TYPES = ['User', 'LostItem', 'FoundItem', 'Claim', 'Location', 'FlagReport'] as const;

export interface User {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  course: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export interface CampusLocation {
  id: string;
  name: string;
  code: string;
  buildingArea: string;
  isHoldingDesk: boolean;
  description: string;
  isActive: boolean;
}

export interface CustodyEvent {
  eventType: CustodyEventType;
  location: string;
  storageBin?: string;
  recipientName?: string;
  recipientId?: string;
  notes?: string;
  recordedByName?: string;
  timestamp: string;
}

export interface LostItem {
  id: string;
  itemName: string;
  category: ItemCategory;
  description: string;
  identifyingDetails?: string;
  lastKnownLocation: string;
  locationRef?: string;
  dateLost: string;
  approximateTimeLost: string;
  imageUrl?: string;
  contactPreference?: ContactPreference;
  status: LostItemStatus;
  moderationStatus?: ListingModerationStatus;
  moderationNotes?: string;
  privacyWarnings?: string[];
  daysOpen?: number;
  isMine?: boolean;
  owner?: Partial<User>;
  createdAt: string;
  updatedAt: string;
}

export interface FoundItem {
  id: string;
  itemName: string;
  category: ItemCategory;
  description: string;
  identifyingDetails?: string;
  locationFound: string;
  locationRef?: string;
  dateFound: string;
  holdingLocation: string;
  storageBin?: string;
  imageUrl?: string;
  status: FoundItemStatus;
  moderationStatus?: ListingModerationStatus;
  moderationNotes?: string;
  collectedAt?: string;
  collectedByName?: string;
  collectedById?: string;
  custodyHistory?: CustodyEvent[];
  unclaimedPolicyAction?: UnclaimedPolicyAction;
  policyActionDate?: string;
  policyNotes?: string;
  privacyWarnings?: string[];
  daysInStorage?: number;
  policyDue?: boolean;
  isMine?: boolean;
  reporter?: Partial<User>;
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: string;
  referenceCode: string;
  foundItemId: string;
  foundItem?: FoundItem;
  linkedLostItemId?: string;
  linkedLostItem?: LostItem;
  claimantId: string;
  claimant?: Partial<User>;
  explanation: string;
  identifyingProof: string;
  status: ClaimStatus;
  verificationMethod?: ClaimVerificationMethod;
  evidenceVerified?: boolean;
  decisionReason?: string;
  outcome?: string;
  verificationNotes: string;
  reviewedBy?: { id: string; fullName: string; role: UserRole };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlagReport {
  id: string;
  targetType: FlagReportTarget;
  targetId: string;
  targetLabel: string;
  reason: FlagReportReason;
  details: string;
  reportedBy?: { id: string; fullName: string; studentId?: string; email?: string; role: UserRole };
  status: FlagReportStatus;
  resolutionNotes: string;
  actionTaken: string;
  resolvedBy?: { id: string; fullName: string; role: UserRole };
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSystemReport {
  generatedAt: string;
  totals: {
    lostReports: number;
    foundItems: number;
    returnedItems: number;
    recoveryRatePercent: number;
  };
  byCategory: Array<{
    category: ItemCategory;
    lostCount: number;
    foundCount: number;
    returnedCount: number;
  }>;
  byHoldingDesk: Array<{
    holdingLocation: string;
    stored: number;
    claimPending: number;
    returned: number;
    archived: number;
  }>;
  claimsBreakdown: {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
    evidenceVerifiedCount: number;
  };
  moderationSummary: {
    openFlags: number;
    resolvedFlags: number;
    hiddenListings: number;
    archivedFound: number;
  };
  overdueSummary: {
    overdueFound30d: number;
    policyDue60d: number;
    policyActionsApplied: number;
  };
  privacyAlerts: Array<{
    id: string;
    type: 'LostItem' | 'FoundItem';
    itemName: string;
    warnings: string[];
  }>;
}

export interface SuggestedMatch<T> {
  score: number;
  reasons: string[];
  item: T;
}

export interface SuggestedMatchesResponse<T> {
  disclaimer: string;
  matches: SuggestedMatch<T>[];
}

export interface AdminMatchPair {
  score: number;
  reasons: string[];
  lostItem: LostItem;
  foundItem: FoundItem;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorRole: UserRole;
  actor?: { id: string; fullName: string; studentId: string; role: UserRole };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AssistantSuggestedListing {
  id: string;
  itemName: string;
  category: ItemCategory;
  description: string;
  locationFound: string;
  holdingLocation: string;
  dateFound: string;
  status: string;
  url: string;
  matchReasons: string[];
  disclaimer: string;
}

export interface AssistantDraft {
  type: 'lost_report' | 'ownership_proof';
  title: string;
  fields: Record<string, string>;
  privacyReminder: string;
}

export interface AssistantReply {
  aiGenerated: true;
  providerMode: 'external_llm' | 'campus_assistant';
  reply: string;
  followUpQuestions: string[];
  suggestedListings: AssistantSuggestedListing[];
  draft?: AssistantDraft;
  staffContact: {
    desk: string;
    hours: string;
    guidance: string;
  };
}
