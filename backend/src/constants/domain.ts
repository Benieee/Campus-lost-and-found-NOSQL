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

export const AUDIT_ENTITY_TYPES = ['User', 'LostItem', 'FoundItem', 'Claim', 'Location'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
