import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import { FOUND_ITEM_STATUSES, ITEM_CATEGORIES } from '../constants/domain';
import { Claim, FoundItem, IFoundItem, Location } from '../models';
import { attachOptionalUser, requireAdmin, requireAuth } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { findSuggestedMatchesForFoundItem } from '../services/matchingService';
import { AppError } from '../utils/errors';
import { serializeFoundItem } from '../utils/serializers';
import {
  assertObjectId,
  createFoundItemSchema,
  escapeRegex,
  parsePagination,
  updateFoundItemSchema
} from '../utils/validation';

export function createFoundItemRouter() {
  const router = Router();

  router.get('/', attachOptionalUser, async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const filter: FilterQuery<IFoundItem> = {};

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
      } else if (req.user?.role !== 'admin' && req.query.mine !== 'true') {
        // By default, hide Archived items from public browsing unless filtered explicitly
        filter.status = { $ne: 'Archived' };
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
      if (req.user?.role === 'admin') {
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
      const query = FoundItem.findById(id);
      if (req.user?.role === 'admin') {
        query.populate('reporter', 'fullName studentId email phone course role');
      }
      const item = await query;
      if (!item) {
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
        imageUrl: parsed.imageUrl || undefined,
        status: 'Stored'
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
      if (parsed.imageUrl !== undefined) item.imageUrl = parsed.imageUrl || undefined;
      if (parsed.status !== undefined) item.status = parsed.status;

      await item.save();

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: previousStatus !== item.status ? 'FOUND_ITEM_STATUS_UPDATED' : 'FOUND_ITEM_UPDATED',
        entityType: 'FoundItem',
        entityId: item._id,
        summary:
          previousStatus !== item.status
            ? `Changed found item "${item.itemName}" status from ${previousStatus} to ${item.status}.`
            : `Updated found item "${item.itemName}".`,
        metadata: { previousStatus, newStatus: item.status, holdingLocation: item.holdingLocation }
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
