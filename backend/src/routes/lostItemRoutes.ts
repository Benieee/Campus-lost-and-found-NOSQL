import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import { ITEM_CATEGORIES, LISTING_MODERATION_STATUSES, LOST_ITEM_STATUSES } from '../constants/domain';
import { ILostItem, Location, LostItem } from '../models';
import { attachOptionalUser, requireAuth } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { findSuggestedMatchesForLostItem } from '../services/matchingService';
import { AppError } from '../utils/errors';
import { serializeLostItem } from '../utils/serializers';
import {
  assertObjectId,
  createLostItemSchema,
  escapeRegex,
  parsePagination,
  updateLostItemSchema
} from '../utils/validation';

export function createLostItemRouter() {
  const router = Router();

  router.get('/', attachOptionalUser, async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const filter: FilterQuery<ILostItem> = {};
      const isAdmin = req.user?.role === 'admin';

      if (req.query.mine === 'true') {
        if (!req.user) {
          throw new AppError(401, 'Sign in to view your lost-item reports.', 'UNAUTHORIZED');
        }
        filter.owner = assertObjectId(req.user.id, 'user ID');
      }

      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
      if (category && (ITEM_CATEGORIES as readonly string[]).includes(category)) {
        filter.category = category;
      }

      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      if (status && (LOST_ITEM_STATUSES as readonly string[]).includes(status)) {
        filter.status = status;
      }

      const moderationStatus =
        typeof req.query.moderationStatus === 'string' ? req.query.moderationStatus.trim() : '';
      if (isAdmin && moderationStatus && (LISTING_MODERATION_STATUSES as readonly string[]).includes(moderationStatus)) {
        filter.moderationStatus = moderationStatus;
      } else if (!isAdmin && req.query.mine !== 'true') {
        filter.moderationStatus = { $nin: ['Hidden', 'Archived'] };
      }

      const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
      if (location) {
        filter.lastKnownLocation = new RegExp(escapeRegex(location), 'i');
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        const regex = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ itemName: regex }, { description: regex }, { lastKnownLocation: regex }];
      }

      const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
      const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
      if (dateFrom || dateTo) {
        filter.dateLost = {};
        if (dateFrom && !Number.isNaN(Date.parse(dateFrom))) {
          filter.dateLost.$gte = new Date(dateFrom);
        }
        if (dateTo && !Number.isNaN(Date.parse(dateTo))) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          filter.dateLost.$lte = end;
        }
        if (Object.keys(filter.dateLost).length === 0) {
          delete filter.dateLost;
        }
      }

      const queryBuilder = LostItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
      if (isAdmin) {
        queryBuilder.populate('owner', 'fullName studentId email phone course role');
      }

      const [items, total] = await Promise.all([queryBuilder.lean(), LostItem.countDocuments(filter)]);
      const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;

      res.json({
        items: items.map((item) => serializeLostItem(item, viewer)),
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
      const id = assertObjectId(req.params.id, 'lost item ID');
      const isAdmin = req.user?.role === 'admin';
      const query = LostItem.findById(id);
      if (isAdmin) {
        query.populate('owner', 'fullName studentId email phone course role');
      }
      const item = await query;
      if (!item) {
        throw new AppError(404, 'Lost-item report not found.', 'NOT_FOUND');
      }

      const isOwner = Boolean(req.user && String(item.owner) === req.user.id);
      if (!isAdmin && !isOwner && (item.moderationStatus === 'Hidden' || item.moderationStatus === 'Archived')) {
        throw new AppError(404, 'Lost-item report not found.', 'NOT_FOUND');
      }

      const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
      const suggested = await findSuggestedMatchesForLostItem(item, viewer, 4);

      res.json({
        item: serializeLostItem(item, viewer),
        suggestedMatches: suggested
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const parsed = createLostItemSchema.parse(req.body);

      let locationRefId;
      if (parsed.locationRef) {
        locationRefId = assertObjectId(parsed.locationRef, 'location reference');
        const locExists = await Location.exists({ _id: locationRefId, isActive: true });
        if (!locExists) {
          throw new AppError(400, 'Selected campus location does not exist or is inactive.', 'INVALID_REFERENCE');
        }
      }

      const item = await LostItem.create({
        owner: assertObjectId(req.user!.id, 'user ID'),
        itemName: parsed.itemName,
        category: parsed.category,
        description: parsed.description,
        identifyingDetails: parsed.identifyingDetails,
        lastKnownLocation: parsed.lastKnownLocation,
        locationRef: locationRefId,
        dateLost: new Date(parsed.dateLost),
        approximateTimeLost: parsed.approximateTimeLost || 'Unknown',
        contactPreference: parsed.contactPreference,
        imageUrl: parsed.imageUrl || undefined,
        status: 'Missing',
        moderationStatus: 'Approved'
      });

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'LOST_ITEM_CREATED',
        entityType: 'LostItem',
        entityId: item._id,
        summary: `Lost report filed for "${item.itemName}" (${item.category}).`
      });

      res.status(201).json({
        item: serializeLostItem(item, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireAuth, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'lost item ID');
      const parsed = updateLostItemSchema.parse(req.body);

      const item = await LostItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Lost-item report not found.', 'NOT_FOUND');
      }

      const isAdmin = req.user!.role === 'admin';
      const isOwner = String(item.owner) === req.user!.id;

      if (!isAdmin && !isOwner) {
        throw new AppError(403, 'You can only edit or withdraw your own lost-item reports.', 'FORBIDDEN');
      }

      if (!isAdmin) {
        if (item.status === 'Claimed' || item.status === 'Closed') {
          throw new AppError(400, `Reports marked as "${item.status}" can no longer be edited.`, 'EDIT_NOT_ALLOWED');
        }
        if (parsed.status && parsed.status !== item.status && parsed.status !== 'Closed') {
          throw new AppError(
            403,
            'Students may only withdraw a lost report by setting its status to Closed.',
            'FORBIDDEN_STATUS'
          );
        }
        if (parsed.moderationStatus !== undefined || parsed.moderationNotes !== undefined) {
          throw new AppError(403, 'Only administrators may change listing moderation status.', 'FORBIDDEN');
        }
      }

      const previousStatus = item.status;
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
      if (parsed.lastKnownLocation !== undefined) item.lastKnownLocation = parsed.lastKnownLocation;
      if (parsed.dateLost !== undefined) item.dateLost = new Date(parsed.dateLost);
      if (parsed.approximateTimeLost !== undefined) item.approximateTimeLost = parsed.approximateTimeLost;
      if (parsed.contactPreference !== undefined) item.contactPreference = parsed.contactPreference;
      if (parsed.imageUrl !== undefined) item.imageUrl = parsed.imageUrl || undefined;
      if (parsed.status !== undefined) item.status = parsed.status;
      if (isAdmin && parsed.moderationStatus !== undefined) item.moderationStatus = parsed.moderationStatus;
      if (isAdmin && parsed.moderationNotes !== undefined) item.moderationNotes = parsed.moderationNotes;

      await item.save();

      if (previousStatus !== item.status || previousModeration !== item.moderationStatus || isAdmin) {
        await recordAuditLog({
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action:
            previousModeration !== item.moderationStatus
              ? 'LOST_ITEM_MODERATED'
              : previousStatus !== item.status
                ? 'LOST_ITEM_STATUS_UPDATED'
                : 'LOST_ITEM_UPDATED',
          entityType: 'LostItem',
          entityId: item._id,
          summary:
            previousModeration !== item.moderationStatus
              ? `Moderated lost report "${item.itemName}" from ${previousModeration} to ${item.moderationStatus}.`
              : previousStatus !== item.status
                ? `Changed lost item "${item.itemName}" status from ${previousStatus} to ${item.status}.`
                : `Updated lost item report "${item.itemName}".`,
          metadata: { previousStatus, newStatus: item.status, moderationStatus: item.moderationStatus }
        });
      }

      res.json({
        item: serializeLostItem(item, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'lost item ID');
      const item = await LostItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Lost-item report not found.', 'NOT_FOUND');
      }

      const isAdmin = req.user!.role === 'admin';
      const isOwner = String(item.owner) === req.user!.id;

      if (!isAdmin && !isOwner) {
        throw new AppError(403, 'You are not authorized to delete this lost-item report.', 'FORBIDDEN');
      }
      if (!isAdmin && item.status === 'Claimed') {
        throw new AppError(400, 'Claimed reports cannot be deleted.', 'DELETE_NOT_ALLOWED');
      }

      await item.deleteOne();
      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'LOST_ITEM_DELETED',
        entityType: 'LostItem',
        entityId: item._id,
        summary: `Deleted lost report "${item.itemName}".`
      });

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
