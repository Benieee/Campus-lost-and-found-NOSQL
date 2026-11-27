import crypto from 'node:crypto';
import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import { CLAIM_STATUSES } from '../constants/domain';
import { Claim, FoundItem, IClaim, LostItem } from '../models';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { createClaimRateLimiter } from '../middleware/rateLimit';
import { recordAuditLog } from '../services/auditService';
import { AppError } from '../utils/errors';
import { serializeClaim } from '../utils/serializers';
import {
  assertObjectId,
  createClaimSchema,
  escapeRegex,
  parsePagination,
  reviewClaimSchema
} from '../utils/validation';

function generateClaimReference(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BLF-${year}-${suffix}`;
}

export function createClaimRouter(rateLimitMax?: number) {
  const router = Router();
  const claimLimiter = createClaimRateLimiter(rateLimitMax);

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const isAdmin = req.user!.role === 'admin';
      const filter: FilterQuery<IClaim> = {};

      if (!isAdmin) {
        filter.claimant = assertObjectId(req.user!.id, 'user ID');
      }

      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      if (status && (CLAIM_STATUSES as readonly string[]).includes(status)) {
        filter.status = status;
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        filter.referenceCode = new RegExp(escapeRegex(q), 'i');
      }

      const queryBuilder = Claim.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('foundItem')
        .populate('linkedLostItem')
        .populate('reviewedBy', 'fullName role');

      if (isAdmin) {
        queryBuilder.populate('claimant', 'fullName studentId email phone course role');
      }

      const [claims, total] = await Promise.all([queryBuilder.lean(), Claim.countDocuments(filter)]);
      const viewer = { id: req.user!.id, role: req.user!.role };

      res.json({
        claims: claims.map((claim) => serializeClaim(claim, viewer)),
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

  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'claim ID');
      const isAdmin = req.user!.role === 'admin';

      const query = Claim.findById(id)
        .populate('foundItem')
        .populate('linkedLostItem')
        .populate('reviewedBy', 'fullName role');
      if (isAdmin) {
        query.populate('claimant', 'fullName studentId email phone course role');
      }

      const claim = await query.lean();
      if (!claim) {
        throw new AppError(404, 'Claim record not found.', 'NOT_FOUND');
      }

      const claimantId =
        typeof claim.claimant === 'object' && claim.claimant && '_id' in claim.claimant
          ? String((claim.claimant as { _id: unknown })._id)
          : String(claim.claimant);

      if (!isAdmin && claimantId !== req.user!.id) {
        throw new AppError(403, 'You are not authorized to view another user’s claim.', 'FORBIDDEN');
      }

      res.json({
        claim: serializeClaim(claim, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, claimLimiter, async (req, res, next) => {
    try {
      const parsed = createClaimSchema.parse(req.body);
      const foundItemId = assertObjectId(parsed.foundItemId, 'found item ID');
      const claimantId = assertObjectId(req.user!.id, 'user ID');

      const foundItem = await FoundItem.findById(foundItemId);
      if (!foundItem) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }

      if (foundItem.status === 'Returned' || foundItem.status === 'Archived') {
        throw new AppError(
          400,
          `This item is marked as "${foundItem.status}" and is no longer available for claims.`,
          'ITEM_UNAVAILABLE'
        );
      }

      if (String(foundItem.reporter) === req.user!.id && req.user!.role !== 'admin') {
        throw new AppError(
          400,
          'You cannot submit an ownership claim on an item you reported as found.',
          'SELF_FOUND_CLAIM_NOT_ALLOWED'
        );
      }

      let linkedLostItemId;
      if (parsed.linkedLostItemId) {
        linkedLostItemId = assertObjectId(parsed.linkedLostItemId, 'lost item ID');
        const lostItem = await LostItem.findById(linkedLostItemId).lean();
        if (!lostItem) {
          throw new AppError(404, 'Linked lost-item report not found.', 'INVALID_REFERENCE');
        }
        if (String(lostItem.owner) !== req.user!.id && req.user!.role !== 'admin') {
          throw new AppError(403, 'You may only link your own lost-item report to a claim.', 'FORBIDDEN');
        }
      }

      const existingActive = await Claim.findOne({
        claimant: claimantId,
        foundItem: foundItemId,
        status: { $in: ['Pending', 'Under Review'] }
      }).lean();

      if (existingActive) {
        throw new AppError(
          409,
          'You already have an active claim pending review for this found item.',
          'DUPLICATE_CLAIM'
        );
      }

      const claim = await Claim.create({
        referenceCode: generateClaimReference(),
        claimant: claimantId,
        foundItem: foundItemId,
        linkedLostItem: linkedLostItemId,
        explanation: parsed.explanation,
        identifyingProof: parsed.identifyingProof,
        status: 'Pending'
      });

      if (foundItem.status === 'Stored') {
        foundItem.status = 'Claim Pending';
        await foundItem.save();
      }

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CLAIM_SUBMITTED',
        entityType: 'Claim',
        entityId: claim._id,
        summary: `Ownership claim ${claim.referenceCode} submitted for "${foundItem.itemName}".`,
        metadata: { foundItemId: String(foundItem._id) }
      });

      const populated = await Claim.findById(claim._id)
        .populate('foundItem')
        .populate('linkedLostItem')
        .lean();

      res.status(201).json({
        claim: serializeClaim(populated, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/review', requireAdmin, async (req, res, next) => {
    try {
      const claimId = assertObjectId(req.params.id, 'claim ID');
      const parsed = reviewClaimSchema.parse(req.body);

      const claim = await Claim.findById(claimId);
      if (!claim) {
        throw new AppError(404, 'Claim record not found.', 'NOT_FOUND');
      }

      if (String(claim.claimant) === req.user!.id) {
        throw new AppError(403, 'Staff members cannot review or approve their own ownership claims.', 'SELF_REVIEW_FORBIDDEN');
      }

      const foundItem = await FoundItem.findById(claim.foundItem);
      if (!foundItem) {
        throw new AppError(404, 'Related found item no longer exists.', 'NOT_FOUND');
      }

      const previousClaimStatus = claim.status;
      const previousFoundStatus = foundItem.status;

      if (parsed.status === 'Approved' && (foundItem.status === 'Returned' || foundItem.status === 'Archived')) {
        throw new AppError(
          409,
          `Cannot approve claim because the found item is already "${foundItem.status}".`,
          'ITEM_ALREADY_RESOLVED'
        );
      }

      const now = new Date();
      const reviewerId = assertObjectId(req.user!.id, 'reviewer ID');

      claim.status = parsed.status;
      claim.verificationNotes = parsed.verificationNotes;
      claim.reviewedBy = reviewerId;
      claim.reviewedAt = now;
      await claim.save();

      if (parsed.status === 'Approved') {
        foundItem.status = 'Returned';
        await foundItem.save();

        if (claim.linkedLostItem) {
          const linkedLost = await LostItem.findById(claim.linkedLostItem);
          if (linkedLost && linkedLost.status !== 'Claimed') {
            const prevLostStatus = linkedLost.status;
            linkedLost.status = 'Claimed';
            await linkedLost.save();
            await recordAuditLog({
              actorId: req.user!.id,
              actorRole: req.user!.role,
              action: 'LOST_ITEM_STATUS_UPDATED',
              entityType: 'LostItem',
              entityId: linkedLost._id,
              summary: `Linked lost report "${linkedLost.itemName}" marked Claimed after claim ${claim.referenceCode} approval.`,
              metadata: { previousStatus: prevLostStatus, newStatus: 'Claimed' }
            });
          }
        }

        // Automatically close other open claims on this item so it cannot be returned twice
        await Claim.updateMany(
          {
            foundItem: foundItem._id,
            _id: { $ne: claim._id },
            status: { $in: ['Pending', 'Under Review'] }
          },
          {
            $set: {
              status: 'Rejected',
              verificationNotes: 'Another ownership claim for this found item was verified and approved.',
              reviewedBy: reviewerId,
              reviewedAt: now
            }
          }
        );
      } else if (parsed.status === 'Under Review') {
        if (foundItem.status === 'Stored') {
          foundItem.status = 'Claim Pending';
          await foundItem.save();
        }
      } else if (parsed.status === 'Rejected') {
        const remainingActive = await Claim.countDocuments({
          foundItem: foundItem._id,
          _id: { $ne: claim._id },
          status: { $in: ['Pending', 'Under Review'] }
        });
        if (remainingActive === 0 && foundItem.status === 'Claim Pending') {
          foundItem.status = 'Stored';
          await foundItem.save();
        }
      }

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: `CLAIM_${parsed.status.toUpperCase().replace(/\s+/g, '_')}`,
        entityType: 'Claim',
        entityId: claim._id,
        summary: `Claim ${claim.referenceCode} changed from ${previousClaimStatus} to ${claim.status}.`,
        metadata: {
          previousStatus: previousClaimStatus,
          newStatus: claim.status,
          foundItemId: String(foundItem._id),
          foundItemPreviousStatus: previousFoundStatus,
          foundItemNewStatus: foundItem.status
        }
      });

      const populated = await Claim.findById(claim._id)
        .populate('foundItem')
        .populate('linkedLostItem')
        .populate('claimant', 'fullName studentId email phone course role')
        .populate('reviewedBy', 'fullName role')
        .lean();

      res.json({
        claim: serializeClaim(populated, { id: req.user!.id, role: req.user!.role })
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
