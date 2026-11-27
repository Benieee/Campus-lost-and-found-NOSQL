import { Types } from 'mongoose';
import { z } from 'zod';
import {
  CLAIM_STATUSES,
  CLAIM_VERIFICATION_METHODS,
  CONTACT_PREFERENCES,
  CUSTODY_EVENT_TYPES,
  FLAG_REPORT_REASONS,
  FLAG_REPORT_STATUSES,
  FLAG_REPORT_TARGETS,
  FOUND_ITEM_STATUSES,
  ITEM_CATEGORIES,
  LISTING_MODERATION_STATUSES,
  LOST_ITEM_STATUSES,
  UNCLAIMED_POLICY_ACTIONS,
  USER_ROLES
} from '../constants/domain';
import { AppError } from './errors';

export function assertObjectId(value: string, label = 'ID'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(400, `Invalid ${label}.`, 'INVALID_ID');
  }
  return new Types.ObjectId(value);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePagination(query: Record<string, unknown>) {
  const pageRaw = Number(query.page ?? 1);
  const limitRaw = Number(query.limit ?? 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(Math.floor(limitRaw), 50) : 10;
  return { page, limit, skip: (page - 1) * limit };
}

export const registerSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(3, 'Student ID must be at least 3 characters.')
    .max(40, 'Student ID is too long.')
    .regex(/^[A-Za-z0-9/_-]+$/, 'Student ID may only contain letters, numbers, slashes, hyphens, or underscores.'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(120),
  email: z.string().trim().email('Please provide a valid email address.').max(254),
  course: z.string().trim().min(2, 'Course or department is required.').max(120),
  phone: z
    .string()
    .trim()
    .min(7, 'Please provide a valid phone number.')
    .max(30)
    .regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password is too long.')
});

export const adminCreateUserSchema = registerSchema.extend({
  role: z.enum(USER_ROLES).default('student')
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address.').max(254),
  password: z.string().min(1, 'Password is required.').max(128)
});

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    course: z.string().trim().min(2).max(120).optional(),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters.')
      .optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one profile field to update.'
  });

const safeDateString = z
  .string()
  .trim()
  .refine((val) => !Number.isNaN(Date.parse(val)), { message: 'Please provide a valid date.' });

const optionalImageUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (val) => val === '' || val.startsWith('/uploads/'),
    'Image URL must be an uploaded file path.'
  )
  .optional();

export const createLostItemSchema = z.object({
  itemName: z.string().trim().min(2, 'Item name is required.').max(120),
  category: z.enum(ITEM_CATEGORIES),
  description: z.string().trim().min(5, 'Description must be at least 5 characters.').max(1200),
  identifyingDetails: z
    .string()
    .trim()
    .min(3, 'Please include identifying details to help staff verify ownership.')
    .max(1000),
  lastKnownLocation: z.string().trim().min(2, 'Last-known location is required.').max(140),
  locationRef: z.string().trim().optional(),
  dateLost: safeDateString,
  approximateTimeLost: z.string().trim().max(60).optional().default('Unknown'),
  contactPreference: z.enum(CONTACT_PREFERENCES).default('email'),
  imageUrl: optionalImageUrl
});

export const updateLostItemSchema = z
  .object({
    itemName: z.string().trim().min(2).max(120).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    description: z.string().trim().min(5).max(1200).optional(),
    identifyingDetails: z.string().trim().min(3).max(1000).optional(),
    lastKnownLocation: z.string().trim().min(2).max(140).optional(),
    locationRef: z.string().trim().nullable().optional(),
    dateLost: safeDateString.optional(),
    approximateTimeLost: z.string().trim().max(60).optional(),
    contactPreference: z.enum(CONTACT_PREFERENCES).optional(),
    imageUrl: optionalImageUrl,
    status: z.enum(LOST_ITEM_STATUSES).optional(),
    moderationStatus: z.enum(LISTING_MODERATION_STATUSES).optional(),
    moderationNotes: z.string().trim().max(500).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.'
  });

export const createFoundItemSchema = z.object({
  itemName: z.string().trim().min(2, 'Item name is required.').max(120),
  category: z.enum(ITEM_CATEGORIES),
  description: z.string().trim().min(5, 'General description must be at least 5 characters.').max(1200),
  identifyingDetails: z
    .string()
    .trim()
    .min(3, 'Private identifying details are required for verification.')
    .max(1000),
  locationFound: z.string().trim().min(2, 'Location found is required.').max(140),
  locationRef: z.string().trim().optional(),
  dateFound: safeDateString,
  holdingLocation: z.string().trim().min(2, 'Holding location is required.').max(140),
  storageBin: z.string().trim().max(80).optional(),
  imageUrl: optionalImageUrl
});

export const updateFoundItemSchema = z
  .object({
    itemName: z.string().trim().min(2).max(120).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    description: z.string().trim().min(5).max(1200).optional(),
    identifyingDetails: z.string().trim().min(3).max(1000).optional(),
    locationFound: z.string().trim().min(2).max(140).optional(),
    locationRef: z.string().trim().nullable().optional(),
    dateFound: safeDateString.optional(),
    holdingLocation: z.string().trim().min(2).max(140).optional(),
    storageBin: z.string().trim().max(80).optional(),
    imageUrl: optionalImageUrl,
    status: z.enum(FOUND_ITEM_STATUSES).optional(),
    moderationStatus: z.enum(LISTING_MODERATION_STATUSES).optional(),
    moderationNotes: z.string().trim().max(500).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.'
  });

export const custodyEventSchema = z.object({
  eventType: z.enum(CUSTODY_EVENT_TYPES),
  location: z.string().trim().min(2, 'Storage or transfer location is required.').max(140),
  storageBin: z.string().trim().max(80).optional(),
  recipientName: z.string().trim().max(120).optional(),
  recipientId: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional()
});

export const unclaimedPolicySchema = z.object({
  policyAction: z.enum(UNCLAIMED_POLICY_ACTIONS).refine((v) => v !== 'None', {
    message: 'Select a university unclaimed-property policy action.'
  }),
  policyNotes: z
    .string()
    .trim()
    .min(5, 'Please record policy notes explaining the unclaimed-property decision.')
    .max(500),
  archiveItem: z.boolean().optional().default(true)
});

export const createClaimSchema = z.object({
  foundItemId: z.string().trim().min(1, 'Found item ID is required.'),
  linkedLostItemId: z.string().trim().optional(),
  explanation: z
    .string()
    .trim()
    .min(10, 'Please explain how and when you lost this item (at least 10 characters).')
    .max(1500),
  identifyingProof: z
    .string()
    .trim()
    .min(5, 'Please provide unique identifying details to prove ownership.')
    .max(1200)
});

export const reviewClaimSchema = z.object({
  status: z.enum(CLAIM_STATUSES),
  verificationNotes: z
    .string()
    .trim()
    .min(3, 'Please record verification notes for the review decision.')
    .max(1500),
  verificationMethod: z.enum(CLAIM_VERIFICATION_METHODS).optional(),
  evidenceVerified: z.boolean().optional(),
  decisionReason: z.string().trim().max(600).optional(),
  outcome: z.string().trim().max(600).optional()
});

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    course: z.string().trim().min(2).max(120).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.'
  });

export const createFlagReportSchema = z.object({
  targetType: z.enum(FLAG_REPORT_TARGETS),
  targetId: z.string().trim().min(1, 'Target record ID is required.'),
  reason: z.enum(FLAG_REPORT_REASONS),
  details: z
    .string()
    .trim()
    .min(5, 'Please describe the issue (at least 5 characters).')
    .max(1200)
});

export const reviewFlagReportSchema = z.object({
  status: z.enum(FLAG_REPORT_STATUSES),
  resolutionNotes: z
    .string()
    .trim()
    .min(3, 'Please record resolution notes (at least 3 characters).')
    .max(1200),
  actionTaken: z.string().trim().max(300).optional()
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(2, 'Location name is required.').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Location code is required.')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Location code may only contain letters, numbers, and hyphens.'),
  buildingArea: z.string().trim().min(2, 'Building or campus zone is required.').max(100),
  isHoldingDesk: z.boolean().default(false),
  description: z.string().trim().max(300).optional().default('')
});

export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/)
      .optional(),
    buildingArea: z.string().trim().min(2).max(100).optional(),
    isHoldingDesk: z.boolean().optional(),
    description: z.string().trim().max(300).optional(),
    isActive: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.'
  });
