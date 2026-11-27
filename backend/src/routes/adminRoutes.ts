import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import { AUDIT_ENTITY_TYPES, USER_ROLES } from '../constants/domain';
import { AuditLog, Claim, FoundItem, IUser, Location, LostItem, User } from '../models';
import { requireAdmin } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { getAdminSuggestedMatchPairs } from '../services/matchingService';
import { AppError } from '../utils/errors';
import { serializeClaim, serializeFoundItem, serializeUser } from '../utils/serializers';
import { adminUpdateUserSchema, assertObjectId, escapeRegex, parsePagination } from '../utils/validation';

export function createAdminRouter() {
  const router = Router();
  router.use(requireAdmin);

  router.get('/dashboard', async (req, res, next) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const viewer = { id: req.user!.id, role: req.user!.role };

      const [
        openLostReports,
        foundItemsInStorage,
        foundClaimPending,
        claimsAwaitingReview,
        recentlyReturnedCount,
        totalReturnedCount,
        totalStudents,
        totalStaff,
        activeLocations,
        recentReturnedItems,
        pendingClaimsList,
        suggestedMatches
      ] = await Promise.all([
        LostItem.countDocuments({ status: { $in: ['Missing', 'Matched'] } }),
        FoundItem.countDocuments({ status: 'Stored' }),
        FoundItem.countDocuments({ status: 'Claim Pending' }),
        Claim.countDocuments({ status: { $in: ['Pending', 'Under Review'] } }),
        FoundItem.countDocuments({ status: 'Returned', updatedAt: { $gte: thirtyDaysAgo } }),
        FoundItem.countDocuments({ status: 'Returned' }),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'admin' }),
        Location.countDocuments({ isActive: true }),
        FoundItem.find({ status: 'Returned' }).sort({ updatedAt: -1 }).limit(5).lean(),
        Claim.find({ status: { $in: ['Pending', 'Under Review'] } })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('foundItem')
          .populate('claimant', 'fullName studentId email phone course role')
          .lean(),
        getAdminSuggestedMatchPairs(viewer, 6)
      ]);

      res.json({
        counts: {
          openLostReports,
          foundItemsInStorage,
          foundClaimPending,
          claimsAwaitingReview,
          recentlyReturnedItems: recentlyReturnedCount,
          totalReturnedItems: totalReturnedCount,
          totalStudents,
          totalStaff,
          activeLocations
        },
        recentReturns: recentReturnedItems.map((item) => serializeFoundItem(item, viewer)),
        awaitingClaims: pendingClaimsList.map((claim) => serializeClaim(claim, viewer)),
        suggestedMatches
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/users', async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const filter: FilterQuery<IUser> = {};

      const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
      if (role && (USER_ROLES as readonly string[]).includes(role)) {
        filter.role = role;
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        const regex = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ fullName: regex }, { email: regex }, { studentId: regex }, { course: regex }];
      }

      const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter)
      ]);

      res.json({
        users: users.map(serializeUser),
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

  router.patch('/users/:id', async (req, res, next) => {
    try {
      const userId = assertObjectId(req.params.id, 'user ID');
      const parsed = adminUpdateUserSchema.parse(req.body);

      if (String(userId) === req.user!.id && (parsed.role === 'student' || parsed.isActive === false)) {
        throw new AppError(400, 'You cannot demote or deactivate your own administrator account.', 'SELF_MODIFICATION_BLOCKED');
      }

      const existing = await User.findById(userId);
      if (!existing) {
        throw new AppError(404, 'User not found.', 'NOT_FOUND');
      }

      const previousRole = existing.role;
      const previousActive = existing.isActive;

      if (parsed.role !== undefined) existing.role = parsed.role;
      if (parsed.isActive !== undefined) existing.isActive = parsed.isActive;
      if (parsed.course !== undefined) existing.course = parsed.course;

      await existing.save();

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'USER_UPDATED',
        entityType: 'User',
        entityId: existing._id,
        summary: `Updated account ${existing.studentId} (role: ${existing.role}, active: ${existing.isActive}).`,
        metadata: {
          previousRole,
          newRole: existing.role,
          previousActive,
          newActive: existing.isActive
        }
      });

      res.json({ user: serializeUser(existing) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/audit-logs', async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const filter: Record<string, unknown> = {};

      const entityType = typeof req.query.entityType === 'string' ? req.query.entityType.trim() : '';
      if (entityType && (AUDIT_ENTITY_TYPES as readonly string[]).includes(entityType)) {
        filter.entityType = entityType;
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('actor', 'fullName studentId role')
          .lean(),
        AuditLog.countDocuments(filter)
      ]);

      res.json({
        logs: logs.map((log: any) => ({
          id: String(log._id),
          action: log.action,
          entityType: log.entityType,
          entityId: String(log.entityId),
          summary: log.summary,
          actorRole: log.actorRole,
          actor:
            log.actor && typeof log.actor === 'object' && 'fullName' in log.actor
              ? {
                  id: String(log.actor._id),
                  fullName: log.actor.fullName,
                  studentId: log.actor.studentId,
                  role: log.actor.role
                }
              : undefined,
          metadata: log.metadata,
          createdAt: log.createdAt
        })),
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

  return router;
}
