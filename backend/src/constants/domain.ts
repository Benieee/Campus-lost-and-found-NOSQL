export const USER_ROLES = ['student', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export const CONTACT_PREFERENCES = ['email', 'phone', 'in_app'] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export const LOST_ITEM_STATUSES = ['Missing', 'Matched', 'Claimed', 'Closed'] as const;
export type LostItemStatus = (typeof LOST_ITEM_STATUSES)[number];

export const FOUND_ITEM_STATUSES = ['Stored', 'Claim Pending', 'Returned', 'Archived'] as const;
export type FoundItemStatus = (typeof FOUND_ITEM_STATUSES)[number];

export const CLAIM_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const LISTING_MODERATION_STATUSES = ['Approved', 'Pending Review', 'Hidden', 'Archived'] as const;
export type ListingModerationStatus = (typeof LISTING_MODERATION_STATUSES)[number];

export const CLAIM_VERIFICATION_METHODS = [
  'In-Person ID Check',
  'Student ID & Proof Match',
  'Serial / Unique Mark Check',
  'Department Verification',
  'Other'
] as const;
export type ClaimVerificationMethod = (typeof CLAIM_VERIFICATION_METHODS)[number];

export const CUSTODY_EVENT_TYPES = ['Stored', 'Transferred', 'Collected', 'Policy Action'] as const;
export type CustodyEventType = (typeof CUSTODY_EVENT_TYPES)[number];

export const UNCLAIMED_POLICY_ACTIONS = [
  'None',
  'Extended Hold',
  'Transferred to University Store',
  'Donated',
  'Disposed'
] as const;
export type UnclaimedPolicyAction = (typeof UNCLAIMED_POLICY_ACTIONS)[number];

export const FLAG_REPORT_TARGETS = ['LostItem', 'FoundItem', 'Claim'] as const;
export type FlagReportTarget = (typeof FLAG_REPORT_TARGETS)[number];

export const FLAG_REPORT_REASONS = [
  'Inaccurate Listing',
  'Duplicate Entry',
  'Suspicious Claim',
  'Inappropriate Content',
  'Privacy Risk',
  'Other'
] as const;
export type FlagReportReason = (typeof FLAG_REPORT_REASONS)[number];

export const FLAG_REPORT_STATUSES = ['Open', 'Investigating', 'Resolved', 'Dismissed'] as const;
export type FlagReportStatus = (typeof FLAG_REPORT_STATUSES)[number];

export const AUDIT_ENTITY_TYPES = [
  'User',
  'LostItem',
  'FoundItem',
  'Claim',
  'Location',
  'FlagReport'
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const OVERDUE_LOST_DAYS = 30;
export const OVERDUE_FOUND_DAYS = 30;
export const UNCLAIMED_POLICY_DAYS = 60;
