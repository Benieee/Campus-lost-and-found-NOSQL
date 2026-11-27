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

export const LOST_STATUSES: LostItemStatus[] = ['Missing', 'Matched', 'Claimed', 'Closed'];
export const FOUND_STATUSES: FoundItemStatus[] = ['Stored', 'Claim Pending', 'Returned', 'Archived'];
export const CLAIM_STATUSES: ClaimStatus[] = ['Pending', 'Under Review', 'Approved', 'Rejected'];

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
  imageUrl?: string;
  status: FoundItemStatus;
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
  verificationNotes: string;
  reviewedBy?: { id: string; fullName: string; role: UserRole };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
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
