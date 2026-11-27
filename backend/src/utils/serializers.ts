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
    verificationNotes: claim.verificationNotes || '',
    reviewedBy: reviewerSummary,
    reviewedAt: claim.reviewedAt || undefined,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt
  };
}
