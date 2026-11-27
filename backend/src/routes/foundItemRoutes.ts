import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import { FOUND_ITEM_STATUSES, ITEM_CATEGORIES, LISTING_MODERATION_STATUSES } from '../constants/domain';
import { Claim, FoundItem, IFoundItem, Location, User } from '../models';
import { attachOptionalUser, requireAdmin, requireAuth } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { findSuggestedMatchesForFoundItem } from '../services/matchingService';
import { AppError } from '../utils/errors';
import { serializeFoundItem } from '../utils/serializers';
import {
  assertObjectId,
  createFoundItemSchema,
  custodyEventSchema,
  escapeRegex,
  parsePagination,
  unclaimedPolicySchema,
  updateFoundItemSchema
} from '../utils/validation';

export function createFoundItemRouter() {
  const router = Router();

  router.get('/', attachOptionalUser, async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const filter: FilterQuery<IFoundItem> = {};
      const isAdmin = req.user?.role === 'admin';

      if (req.query.mine === 'true') {
        if (!req.user) {
          throw new AppError(401, 'Sign in to view found items you reported.', 'UNAUTHORIZED');
        }
        filter.reporter = assertObjectId(req.user.id, 'user ID');
      }

      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
      if (category && (ITEM_CATEGORIES as readonly string[]).includes(category)) {
        filter.category = category;
      }

      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      if (status && (FOUND_ITEM_STATUSES as readonly string[]).includes(status)) {
        filter.status = status;
      } else if (!isAdmin && req.query.mine !== 'true') {
        // By default, hide Archived items from public browsing unless filtered explicitly
        filter.status = { $ne: 'Archived' };
      }

      const moderationStatus =
        typeof req.query.moderationStatus === 'string' ? req.query.moderationStatus.trim() : '';
      if (isAdmin && moderationStatus && (LISTING_MODERATION_STATUSES as readonly string[]).includes(moderationStatus)) {
        filter.moderationStatus = moderationStatus;
      } else if (!isAdmin && req.query.mine !== 'true') {
        // Hide Hidden or Archived moderated listings from public browsing
        filter.moderationStatus = { $nin: ['Hidden', 'Archived'] };
      }

      const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
      if (location) {
        const locRegex = new RegExp(escapeRegex(location), 'i');
        filter.$and = [
          ...(filter.$and || []),
          { $or: [{ locationFound: locRegex }, { holdingLocation: locRegex }] }
        ];
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        const regex = new RegExp(escapeRegex(q), 'i');
        filter.$and = [
          ...(filter.$and || []),
          { $or: [{ itemName: regex }, { description: regex }, { locationFound: regex }, { holdingLocation: regex }] }
        ];
      }

      const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
      const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
      if (dateFrom || dateTo) {
        filter.dateFound = {};
        if (dateFrom && !Number.isNaN(Date.parse(dateFrom))) {
          filter.dateFound.$gte = new Date(dateFrom);
        }
        if (dateTo && !Number.isNaN(Date.parse(dateTo))) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          filter.dateFound.$lte = end;
        }
        if (Object.keys(filter.dateFound).length === 0) {
          delete filter.dateFound;
        }
      }

      const queryBuilder = FoundItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
      if (isAdmin) {
        queryBuilder.populate('reporter', 'fullName studentId email phone course role');
      }

      const [items, total] = await Promise.all([queryBuilder.lean(), FoundItem.countDocuments(filter)]);
      const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;

      res.json({
        items: items.map((item) => serializeFoundItem(item, viewer)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', attachOptionalUser, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'found item ID');
      const isAdmin = req.user?.role === 'admin';
      const query = FoundItem.findById(id);
      if (isAdmin) {
        query.populate('reporter', 'fullName studentId email phone course role');
      }
      const item = await query;
      if (!item) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      const isReporter = Boolean(req.user && String(item.reporter) === req.user.id);
      if (!isAdmin && !isReporter && (item.moderationStatus === 'Hidden' || item.moderationStatus === 'Archived')) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
      const suggestedMatches = await findSuggestedMatchesForFoundItem(item, viewer, 4);

      res.json({
        item: serializeFoundItem(item, viewer),
        suggestedMatches
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const parsed = createFoundItemSchema.parse(req.body);

      let locationRefId;
      if (parsed.locationRef) {
        locationRefId = assertObjectId(parsed.locationRef, 'location reference');
        const locExists = await Location.exists({ _id: locationRefId, isActive: true });
        if (!locExists) {
          throw new AppError(400, 'Selected campus location does not exist or is inactive.', 'INVALID_REFERENCE');
        }
      }

      const actorUser = await User.findById(req.user!.id).select('fullName').lean();
      const item = await FoundItem.create({
        reporter: assertObjectId(req.user!.id, 'user ID'),
        itemName: parsed.itemName,
        category: parsed.category,
        description: parsed.description,
        identifyingDetails: parsed.identifyingDetails,
        locationFound: parsed.locationFound,
        locationRef: locationRefId,
        dateFound: new Date(parsed.dateFound),
        holdingLocation: parsed.holdingLocation,
        storageBin: parsed.storageBin || '',
        imageUrl: parsed.imageUrl || undefined,
        status: 'Stored',
        moderationStatus: 'Approved',
        custodyHistory: [
          {
            eventType: 'Stored',
            location: parsed.holdingLocation,
            storageBin: parsed.storageBin || undefined,
            notes: 'Initial intake and storage record.',
            recordedBy: assertObjectId(req.user!.id, 'user ID'),
            recordedByName: actorUser?.fullName || 'Campus Staff',
            timestamp: new Date()
          }
        ]
      });

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'FOUND_ITEM_CREATED',
        entityType: 'FoundItem',
        entityId: item._id,
        summary: `Found item recorded: "${item.itemName}" held at ${item.holdingLocation}.`
      });

      res.status(201).json({
        item: serializeFoundItem(item, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'found item ID');
      const parsed = updateFoundItemSchema.parse(req.body);

      const item = await FoundItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      const previousStatus = item.status;
      const previousHolding = item.holdingLocation;
      const previousBin = item.storageBin || '';
      const previousModeration = item.moderationStatus || 'Approved';

      if (parsed.locationRef !== undefined) {
        if (parsed.locationRef === null || parsed.locationRef === '') {
          item.locationRef = undefined;
        } else {
          const refId = assertObjectId(parsed.locationRef, 'location reference');
          const locExists = await Location.exists({ _id: refId });
          if (!locExists) {
            throw new AppError(400, 'Selected campus location does not exist.', 'INVALID_REFERENCE');
          }
          item.locationRef = refId;
        }
      }

      if (parsed.itemName !== undefined) item.itemName = parsed.itemName;
      if (parsed.category !== undefined) item.category = parsed.category;
      if (parsed.description !== undefined) item.description = parsed.description;
      if (parsed.identifyingDetails !== undefined) item.identifyingDetails = parsed.identifyingDetails;
      if (parsed.locationFound !== undefined) item.locationFound = parsed.locationFound;
      if (parsed.dateFound !== undefined) item.dateFound = new Date(parsed.dateFound);
      if (parsed.holdingLocation !== undefined) item.holdingLocation = parsed.holdingLocation;
      if (parsed.storageBin !== undefined) item.storageBin = parsed.storageBin;
      if (parsed.imageUrl !== undefined) item.imageUrl = parsed.imageUrl || undefined;
      if (parsed.status !== undefined) item.status = parsed.status;
      if (parsed.moderationStatus !== undefined) item.moderationStatus = parsed.moderationStatus;
      if (parsed.moderationNotes !== undefined) item.moderationNotes = parsed.moderationNotes;

      const actorUser = await User.findById(req.user!.id).select('fullName').lean();
      if (
        (parsed.holdingLocation !== undefined && parsed.holdingLocation !== previousHolding) ||
        (parsed.storageBin !== undefined && parsed.storageBin !== previousBin)
      ) {
        item.custodyHistory.push({
          eventType: 'Transferred',
          location: item.holdingLocation,
          storageBin: item.storageBin || undefined,
          notes: `Updated storage from "${previousHolding}${previousBin ? ` (${previousBin})` : ''}" to "${item.holdingLocation}${item.storageBin ? ` (${item.storageBin})` : ''}".`,
          recordedBy: assertObjectId(req.user!.id, 'user ID'),
          recordedByName: actorUser?.fullName || 'Admin Staff',
          timestamp: new Date()
        });
      }

      if (parsed.status === 'Returned' && previousStatus !== 'Returned' && !item.collectedAt) {
        item.collectedAt = new Date();
        item.custodyHistory.push({
          eventType: 'Collected',
          location: item.holdingLocation,
          storageBin: item.storageBin || undefined,
          notes: 'Marked as Returned to owner by administrator.',
          recordedBy: assertObjectId(req.user!.id, 'user ID'),
          recordedByName: actorUser?.fullName || 'Admin Staff',
          timestamp: new Date()
        });
      }

      await item.save();

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action:
          previousModeration !== item.moderationStatus
            ? 'FOUND_ITEM_MODERATED'
            : previousStatus !== item.status
              ? 'FOUND_ITEM_STATUS_UPDATED'
              : 'FOUND_ITEM_UPDATED',
        entityType: 'FoundItem',
        entityId: item._id,
        summary:
          previousModeration !== item.moderationStatus
            ? `Moderated found item "${item.itemName}" from ${previousModeration} to ${item.moderationStatus}.`
            : previousStatus !== item.status
              ? `Changed found item "${item.itemName}" status from ${previousStatus} to ${item.status}.`
              : `Updated found item "${item.itemName}".`,
        metadata: {
          previousStatus,
          newStatus: item.status,
          holdingLocation: item.holdingLocation,
          storageBin: item.storageBin,
          moderationStatus: item.moderationStatus
        }
      });

      res.json({
        item: serializeFoundItem(item, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  // Record storage update, desk-to-desk transfer, or in-person collection
  router.post('/:id/custody', requireAdmin, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'found item ID');
      const parsed = custodyEventSchema.parse(req.body);

      const item = await FoundItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      const actorUser = await User.findById(req.user!.id).select('fullName').lean();
      const now = new Date();

      item.holdingLocation = parsed.location;
      if (parsed.storageBin !== undefined) {
        item.storageBin = parsed.storageBin;
      }

      if (parsed.eventType === 'Collected') {
        item.status = 'Returned';
        item.collectedAt = now;
        if (parsed.recipientName) item.collectedByName = parsed.recipientName;
        if (parsed.recipientId) item.collectedById = parsed.recipientId;
      }

      item.custodyHistory.push({
        eventType: parsed.eventType,
        location: parsed.location,
        storageBin: parsed.storageBin || undefined,
        recipientName: parsed.recipientName || undefined,
        recipientId: parsed.recipientId || undefined,
        notes: parsed.notes || undefined,
        recordedBy: assertObjectId(req.user!.id, 'user ID'),
        recordedByName: actorUser?.fullName || 'Admin Staff',
        timestamp: now
      });

      await item.save();

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: `FOUND_ITEM_${parsed.eventType.toUpperCase().replace(/\s+/g, '_')}`,
        entityType: 'FoundItem',
        entityId: item._id,
        summary: `Recorded ${parsed.eventType} event for "${item.itemName}" at ${parsed.location}${parsed.storageBin ? ` (${parsed.storageBin})` : ''}.`,
        metadata: {
          eventType: parsed.eventType,
          location: parsed.location,
          storageBin: parsed.storageBin,
          status: item.status
        }
      });

      res.json({
        item: serializeFoundItem(item, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  // Apply university unclaimed-property policy action to overdue found item
  router.post('/:id/unclaimed-policy', requireAdmin, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'found item ID');
      const parsed = unclaimedPolicySchema.parse(req.body);

      const item = await FoundItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      const actorUser = await User.findById(req.user!.id).select('fullName').lean();
      const now = new Date();

      item.unclaimedPolicyAction = parsed.policyAction;
      item.policyActionDate = now;
      item.policyNotes = parsed.policyNotes;
      if (parsed.archiveItem && parsed.policyAction !== 'Extended Hold') {
        item.status = 'Archived';
      }

      item.custodyHistory.push({
        eventType: 'Policy Action',
        location: item.holdingLocation,
        storageBin: item.storageBin || undefined,
        notes: `Unclaimed policy applied (${parsed.policyAction}): ${parsed.policyNotes}`,
        recordedBy: assertObjectId(req.user!.id, 'user ID'),
        recordedByName: actorUser?.fullName || 'Admin Staff',
        timestamp: now
      });

      await item.save();

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'UNCLAIMED_POLICY_APPLIED',
        entityType: 'FoundItem',
        entityId: item._id,
        summary: `Applied unclaimed-property policy "${parsed.policyAction}" to "${item.itemName}".`,
        metadata: {
          policyAction: parsed.policyAction,
          status: item.status
        }
      });

      res.json({
        item: serializeFoundItem(item, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'found item ID');
      const item = await FoundItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      const activeClaims = await Claim.countDocuments({
        foundItem: id,
        status: { $in: ['Pending', 'Under Review'] }
      });
      const forceDelete = req.query.force === 'true';

      if (activeClaims > 0 && !forceDelete) {
        throw new AppError(
          409,
          'Cannot delete a found item while active ownership claims exist. Resolve claims first or confirm forced removal.',
          'ACTIVE_CLAIMS_EXIST'
        );
      }

      if (activeClaims > 0 && forceDelete) {
        await Claim.updateMany(
          { foundItem: id, status: { $in: ['Pending', 'Under Review'] } },
          {
            $set: {
              status: 'Rejected',
              verificationNotes: 'Closed automatically when the item was removed by an administrator.',
              decisionReason: 'Associated item removed from inventory.',
              outcome: 'Closed automatically on item deletion',
              reviewedBy: assertObjectId(req.user!.id, 'reviewer ID'),
              reviewedAt: new Date()
            }
          }
        );
      }

      await item.deleteOne();
      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'FOUND_ITEM_DELETED',
        entityType: 'FoundItem',
        entityId: item._id,
        summary: `Deleted found item "${item.itemName}"${forceDelete && activeClaims > 0 ? ` (closed ${activeClaims} open claim(s))` : ''}.`,
        metadata: { previousStatus: item.status, forceDelete }
      });

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
