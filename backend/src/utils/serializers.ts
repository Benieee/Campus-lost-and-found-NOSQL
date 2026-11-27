import { Types } from 'mongoose';
import { UserRole } from '../constants/domain';

export interface ViewerContext {
  id: string;
  role: UserRole;
}

function getRefId(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (ref instanceof Types.ObjectId) return ref.toString();
  if (typeof ref === 'object' && '_id' in (ref as Record<string, unknown>)) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

/**
 * Scans public listing text (title + public description) for patterns that may accidentally
 * expose sensitive personal or verification details (phone numbers, emails, student IDs, serial numbers).
 * Surfaced only to administrators so they can review and redact public listings.
 */
export function detectPublicPrivacyRisks(text: string): string[] {
  const warnings: string[] = [];
  if (!text) return warnings;

  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) {
    warnings.push('Email address detected in public text');
  }
  if (/(?:\+?256|0)[\s-]?7\d{2}[\s-]?\d{3}[\s-]?\d{3}|\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{3,4}/.test(text)) {
    warnings.push('Phone number detected in public text');
  }
  if (/\b\d{2}\/[A-Z]{2,5}\/[A-Z]{2,4}\/[A-Z]\/\d{3,5}\b/i.test(text)) {
    warnings.push('Student ID format detected in public text');
  }
  if (/\b(?:serial|imei|pin|nin|passport|card\s*(?:no|number|#))\s*[:#-]?\s*[A-Za-z0-9-]{4,}/i.test(text)) {
    warnings.push('Serial / ID / PIN reference detected in public text');
  }

  return warnings;
}

export function serializeUser(user: any) {
  if (!user) return null;
  return {
    id: String(user._id),
    studentId: user.studentId,
    fullName: user.fullName,
    email: user.email,
    course: user.course,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function serializeUserSummary(user: any) {
  if (!user || typeof user !== 'object' || !('fullName' in user)) return undefined;
  return {
    id: String(user._id),
    studentId: user.studentId,
    fullName: user.fullName,
    course: user.course,
    email: user.email,
    phone: user.phone,
    role: user.role
  };
}

export function serializeLostItem(item: any, viewer?: ViewerContext | null) {
  const ownerId = getRefId(item.owner);
  const isAdmin = viewer?.role === 'admin';
  const isOwner = Boolean(viewer && viewer.id === ownerId);
  const canSeePrivate = isAdmin || isOwner;

  const base: Record<string, unknown> = {
    id: String(item._id),
    itemName: item.itemName,
    category: item.category,
    description: item.description,
    lastKnownLocation: item.lastKnownLocation,
    locationRef: item.locationRef ? getRefId(item.locationRef) : undefined,
    dateLost: item.dateLost,
    approximateTimeLost: item.approximateTimeLost,
    imageUrl: item.imageUrl || undefined,
    status: item.status,
    moderationStatus: item.moderationStatus || 'Approved',
    isMine: isOwner,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  if (canSeePrivate) {
    base.identifyingDetails = item.identifyingDetails;
    base.contactPreference = item.contactPreference;
    base.ownerId = ownerId;
    const ownerSummary = serializeUserSummary(item.owner);
    if (ownerSummary) {
      base.owner = ownerSummary;
    }
  }

  if (isAdmin) {
    base.moderationNotes = item.moderationNotes || '';
    const privacyWarnings = detectPublicPrivacyRisks(`${item.itemName || ''} ${item.description || ''}`);
    if (privacyWarnings.length > 0) {
      base.privacyWarnings = privacyWarnings;
    }
  }

  return base;
}

export function serializeFoundItem(item: any, viewer?: ViewerContext | null) {
  const reporterId = getRefId(item.reporter);
  const isAdmin = viewer?.role === 'admin';
  const isReporter = Boolean(viewer && viewer.id === reporterId);

  const base: Record<string, unknown> = {
    id: String(item._id),
    itemName: item.itemName,
    category: item.category,
    description: item.description,
    locationFound: item.locationFound,
    locationRef: item.locationRef ? getRefId(item.locationRef) : undefined,
    dateFound: item.dateFound,
    holdingLocation: item.holdingLocation,
    imageUrl: item.imageUrl || undefined,
    status: item.status,
    moderationStatus: item.moderationStatus || 'Approved',
    isMine: isReporter,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  // Sensitive identifying details are NEVER exposed to unauthenticated visitors or non-owner claimants
  if (isAdmin || isReporter) {
    base.identifyingDetails = item.identifyingDetails;
  }

  if (isAdmin) {
    base.reporterId = reporterId;
    const reporterSummary = serializeUserSummary(item.reporter);
    if (reporterSummary) {
      base.reporter = reporterSummary;
    }
    base.storageBin = item.storageBin || '';
    base.moderationNotes = item.moderationNotes || '';
    base.collectedAt = item.collectedAt || undefined;
    base.collectedByName = item.collectedByName || undefined;
    base.collectedById = item.collectedById || undefined;
    base.custodyHistory = Array.isArray(item.custodyHistory)
      ? item.custodyHistory.map((ev: any) => ({
          eventType: ev.eventType,
          location: ev.location,
          storageBin: ev.storageBin || undefined,
          recipientName: ev.recipientName || undefined,
          recipientId: ev.recipientId || undefined,
          notes: ev.notes || undefined,
          recordedByName: ev.recordedByName || undefined,
          timestamp: ev.timestamp
        }))
      : [];
    base.unclaimedPolicyAction = item.unclaimedPolicyAction || 'None';
    base.policyActionDate = item.policyActionDate || undefined;
    base.policyNotes = item.policyNotes || '';
    const privacyWarnings = detectPublicPrivacyRisks(`${item.itemName || ''} ${item.description || ''}`);
    if (privacyWarnings.length > 0) {
      base.privacyWarnings = privacyWarnings;
    }
  }

  return base;
}

export function serializeClaim(claim: any, viewer: ViewerContext) {
  const isAdmin = viewer.role === 'admin';
  const foundItemData =
    claim.foundItem && typeof claim.foundItem === 'object' && 'itemName' in claim.foundItem
      ? serializeFoundItem(claim.foundItem, viewer)
      : undefined;

  const linkedLostItemData =
    claim.linkedLostItem && typeof claim.linkedLostItem === 'object' && 'itemName' in claim.linkedLostItem
      ? serializeLostItem(claim.linkedLostItem, viewer)
      : undefined;

  const reviewerSummary =
    claim.reviewedBy && typeof claim.reviewedBy === 'object' && 'fullName' in claim.reviewedBy
      ? {
          id: String(claim.reviewedBy._id),
          fullName: claim.reviewedBy.fullName,
          role: claim.reviewedBy.role
        }
      : undefined;

  return {
    id: String(claim._id),
    referenceCode: claim.referenceCode,
    foundItemId: getRefId(claim.foundItem),
    foundItem: foundItemData,
    linkedLostItemId: claim.linkedLostItem ? getRefId(claim.linkedLostItem) : undefined,
    linkedLostItem: linkedLostItemData,
    claimantId: getRefId(claim.claimant),
    claimant: isAdmin ? serializeUserSummary(claim.claimant) : undefined,
    explanation: claim.explanation,
    identifyingProof: claim.identifyingProof,
    status: claim.status,
    verificationMethod: claim.verificationMethod || undefined,
    evidenceVerified: Boolean(claim.evidenceVerified),
    decisionReason: claim.decisionReason || '',
    outcome: claim.outcome || '',
    verificationNotes: claim.verificationNotes || '',
    reviewedBy: reviewerSummary,
    reviewedAt: claim.reviewedAt || undefined,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt
  };
}

export function serializeFlagReport(report: any) {
  const reporter =
    report.reportedBy && typeof report.reportedBy === 'object' && 'fullName' in report.reportedBy
      ? {
          id: String(report.reportedBy._id),
          fullName: report.reportedBy.fullName,
          studentId: report.reportedBy.studentId,
          email: report.reportedBy.email,
          role: report.reportedBy.role
        }
      : undefined;

  const resolver =
    report.resolvedBy && typeof report.resolvedBy === 'object' && 'fullName' in report.resolvedBy
      ? {
          id: String(report.resolvedBy._id),
          fullName: report.resolvedBy.fullName,
          role: report.resolvedBy.role
        }
      : undefined;

  return {
    id: String(report._id),
    targetType: report.targetType,
    targetId: getRefId(report.targetId),
    targetLabel: report.targetLabel,
    reason: report.reason,
    details: report.details,
    reportedBy: reporter,
    status: report.status,
    resolutionNotes: report.resolutionNotes || '',
    actionTaken: report.actionTaken || '',
    resolvedBy: resolver,
    resolvedAt: report.resolvedAt || undefined,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}
