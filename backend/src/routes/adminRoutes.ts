import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import {
  AUDIT_ENTITY_TYPES,
  ITEM_CATEGORIES,
  OVERDUE_FOUND_DAYS,
  OVERDUE_LOST_DAYS,
  UNCLAIMED_POLICY_DAYS,
  USER_ROLES
} from '../constants/domain';
import { AuditLog, Claim, FlagReport, FoundItem, IUser, Location, LostItem, User } from '../models';
import { requireAdmin } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { getAdminSuggestedMatchPairs } from '../services/matchingService';
import { hashPassword } from '../utils/auth';
import { AppError } from '../utils/errors';
import {
  detectPublicPrivacyRisks,
  serializeClaim,
  serializeFoundItem,
  serializeLostItem,
  serializeUser
} from '../utils/serializers';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  assertObjectId,
  escapeRegex,
  parsePagination
} from '../utils/validation';

const DAY_MS = 24 * 60 * 60 * 1000;

export function createAdminRouter() {
  const router = Router();
  router.use(requireAdmin);

  router.get('/dashboard', async (req, res, next) => {
    try {
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
      const overdueLostCutoff = new Date(now - OVERDUE_LOST_DAYS * DAY_MS);
      const overdueFoundCutoff = new Date(now - OVERDUE_FOUND_DAYS * DAY_MS);
      const policyCutoff = new Date(now - UNCLAIMED_POLICY_DAYS * DAY_MS);
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
        openFlagReports,
        overdueFoundItems,
        policyDueFoundItems,
        overdueLostItems,
        recentReturnedItems,
        pendingClaimsList,
        recentActivityLogs,
        suggestedMatches,
        activeLostForPrivacy,
        activeFoundForPrivacy
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
        FlagReport.countDocuments({ status: { $in: ['Open', 'Investigating'] } }),
        FoundItem.countDocuments({
          status: { $in: ['Stored', 'Claim Pending'] },
          dateFound: { $lte: overdueFoundCutoff }
        }),
        FoundItem.countDocuments({
          status: { $in: ['Stored', 'Claim Pending'] },
          dateFound: { $lte: policyCutoff }
        }),
        LostItem.countDocuments({
          status: { $in: ['Missing', 'Matched'] },
          dateLost: { $lte: overdueLostCutoff }
        }),
        FoundItem.find({ status: 'Returned' }).sort({ updatedAt: -1 }).limit(5).lean(),
        Claim.find({ status: { $in: ['Pending', 'Under Review'] } })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('foundItem')
          .populate('claimant', 'fullName studentId email phone course role')
          .lean(),
        AuditLog.find({})
          .sort({ createdAt: -1 })
          .limit(8)
          .populate('actor', 'fullName studentId role')
          .lean(),
        getAdminSuggestedMatchPairs(viewer, 6),
        LostItem.find({ moderationStatus: { $nin: ['Hidden', 'Archived'] } })
          .select('itemName description')
          .limit(200)
          .lean(),
        FoundItem.find({ moderationStatus: { $nin: ['Hidden', 'Archived'] } })
          .select('itemName description')
          .limit(200)
          .lean()
      ]);

      let privacyWarningCount = 0;
      for (const item of activeLostForPrivacy) {
        if (detectPublicPrivacyRisks(`${item.itemName} ${item.description}`).length > 0) {
          privacyWarningCount += 1;
        }
      }
      for (const item of activeFoundForPrivacy) {
        if (detectPublicPrivacyRisks(`${item.itemName} ${item.description}`).length > 0) {
          privacyWarningCount += 1;
        }
      }

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
          activeLocations,
          openFlagReports,
          overdueFoundItems,
          policyDueFoundItems,
          overdueLostItems,
          privacyWarningCount
        },
        recentReturns: recentReturnedItems.map((item) => serializeFoundItem(item, viewer)),
        awaitingClaims: pendingClaimsList.map((claim) => serializeClaim(claim, viewer)),
        recentActivity: recentActivityLogs.map((log: any) => ({
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
          createdAt: log.createdAt
        })),
        suggestedMatches
      });
    } catch (err) {
      next(err);
    }
  });

  // Unresolved & overdue items + university unclaimed-property policy monitor
  router.get('/overdue', async (req, res, next) => {
    try {
      const now = Date.now();
      const overdueLostCutoff = new Date(now - OVERDUE_LOST_DAYS * DAY_MS);
      const overdueFoundCutoff = new Date(now - OVERDUE_FOUND_DAYS * DAY_MS);
      const viewer = { id: req.user!.id, role: req.user!.role };

      const [overdueFoundRaw, overdueLostRaw] = await Promise.all([
        FoundItem.find({
          status: { $in: ['Stored', 'Claim Pending'] },
          dateFound: { $lte: overdueFoundCutoff }
        })
          .sort({ dateFound: 1 })
          .populate('reporter', 'fullName studentId email phone course role')
          .lean(),
        LostItem.find({
          status: { $in: ['Missing', 'Matched'] },
          dateLost: { $lte: overdueLostCutoff }
        })
          .sort({ dateLost: 1 })
          .populate('owner', 'fullName studentId email phone course role')
          .lean()
      ]);

      const overdueFound = overdueFoundRaw.map((item) => {
        const daysInStorage = Math.floor((now - new Date(item.dateFound).getTime()) / DAY_MS);
        return {
          ...serializeFoundItem(item, viewer),
          daysInStorage,
          policyDue: daysInStorage >= UNCLAIMED_POLICY_DAYS
        };
      });

      const overdueLost = overdueLostRaw.map((item) => {
        const daysOpen = Math.floor((now - new Date(item.dateLost).getTime()) / DAY_MS);
        return {
          ...serializeLostItem(item, viewer),
          daysOpen
        };
      });

      res.json({
        thresholds: {
          overdueLostDays: OVERDUE_LOST_DAYS,
          overdueFoundDays: OVERDUE_FOUND_DAYS,
          unclaimedPolicyDays: UNCLAIMED_POLICY_DAYS
        },
        policySummary:
          'Proposed Bugema University Unclaimed Property Guideline: Found items held over 30 days are flagged for follow-up; items unclaimed after 60 days may be given an Extended Hold, Transferred to University Store, Donated, or Disposed with logged authorization.',
        overdueFound,
        overdueLost
      });
    } catch (err) {
      next(err);
    }
  });

  // Basic system reports & operational analytics
  router.get('/reports', async (_req, res, next) => {
    try {
      const now = Date.now();
      const overdueFoundCutoff = new Date(now - OVERDUE_FOUND_DAYS * DAY_MS);
      const policyCutoff = new Date(now - UNCLAIMED_POLICY_DAYS * DAY_MS);

      const [lostItems, foundItems, claims, flags] = await Promise.all([
        LostItem.find({}).select('category status moderationStatus dateLost itemName description').lean(),
        FoundItem.find({}).select('category status moderationStatus holdingLocation dateFound unclaimedPolicyAction itemName description').lean(),
        Claim.find({}).select('status verificationMethod evidenceVerified').lean(),
        FlagReport.find({}).select('status reason').lean()
      ]);

      const byCategory = ITEM_CATEGORIES.map((category) => {
        const lostCount = lostItems.filter((i) => i.category === category).length;
        const foundCount = foundItems.filter((i) => i.category === category).length;
        const returnedCount = foundItems.filter((i) => i.category === category && i.status === 'Returned').length;
        return { category, lostCount, foundCount, returnedCount };
      }).filter((row) => row.lostCount > 0 || row.foundCount > 0);

      const deskMap = new Map<string, { holdingLocation: string; stored: number; claimPending: number; returned: number; archived: number }>();
      for (const item of foundItems) {
        const key = item.holdingLocation || 'Unassigned';
        const entry = deskMap.get(key) || { holdingLocation: key, stored: 0, claimPending: 0, returned: 0, archived: 0 };
        if (item.status === 'Stored') entry.stored += 1;
        else if (item.status === 'Claim Pending') entry.claimPending += 1;
        else if (item.status === 'Returned') entry.returned += 1;
        else if (item.status === 'Archived') entry.archived += 1;
        deskMap.set(key, entry);
      }

      const claimsBreakdown = {
        total: claims.length,
        pending: claims.filter((c) => c.status === 'Pending').length,
        underReview: claims.filter((c) => c.status === 'Under Review').length,
        approved: claims.filter((c) => c.status === 'Approved').length,
        rejected: claims.filter((c) => c.status === 'Rejected').length,
        evidenceVerifiedCount: claims.filter((c) => c.evidenceVerified).length
      };

      const moderationSummary = {
        openFlags: flags.filter((f) => f.status === 'Open' || f.status === 'Investigating').length,
        resolvedFlags: flags.filter((f) => f.status === 'Resolved' || f.status === 'Dismissed').length,
        hiddenListings:
          lostItems.filter((i) => i.moderationStatus === 'Hidden').length +
          foundItems.filter((i) => i.moderationStatus === 'Hidden').length,
        archivedFound: foundItems.filter((i) => i.status === 'Archived').length
      };

      const totalFound = foundItems.length;
      const totalReturned = foundItems.filter((i) => i.status === 'Returned').length;
      const recoveryRatePercent = totalFound > 0 ? Math.round((totalReturned / totalFound) * 100) : 0;

      const overdueSummary = {
        overdueFound30d: foundItems.filter(
          (i) => (i.status === 'Stored' || i.status === 'Claim Pending') && new Date(i.dateFound) <= overdueFoundCutoff
        ).length,
        policyDue60d: foundItems.filter(
          (i) => (i.status === 'Stored' || i.status === 'Claim Pending') && new Date(i.dateFound) <= policyCutoff
        ).length,
        policyActionsApplied: foundItems.filter((i) => i.unclaimedPolicyAction && i.unclaimedPolicyAction !== 'None').length
      };

      const privacyAlerts = [
        ...lostItems
          .map((i) => ({
            id: String(i._id),
            type: 'LostItem' as const,
            itemName: i.itemName,
            warnings: detectPublicPrivacyRisks(`${i.itemName} ${i.description}`)
          }))
          .filter((x) => x.warnings.length > 0),
        ...foundItems
          .map((i) => ({
            id: String(i._id),
            type: 'FoundItem' as const,
            itemName: i.itemName,
            warnings: detectPublicPrivacyRisks(`${i.itemName} ${i.description}`)
          }))
          .filter((x) => x.warnings.length > 0)
      ];

      res.json({
        generatedAt: new Date().toISOString(),
        totals: {
          lostReports: lostItems.length,
          foundItems: totalFound,
          returnedItems: totalReturned,
          recoveryRatePercent
        },
        byCategory,
        byHoldingDesk: Array.from(deskMap.values()),
        claimsBreakdown,
        moderationSummary,
        overdueSummary,
        privacyAlerts
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

  // Provision new authorized staff/admin or student account directly
  router.post('/users', async (req, res, next) => {
    try {
      const parsed = adminCreateUserSchema.parse(req.body);
      const email = parsed.email.toLowerCase();
      const studentId = parsed.studentId.toUpperCase();

      const existing = await User.findOne({ $or: [{ email }, { studentId }] }).lean();
      if (existing) {
        throw new AppError(409, 'An account with this email or student/staff ID already exists.', 'DUPLICATE_ACCOUNT');
      }

      const passwordHash = await hashPassword(parsed.password);
      const created = await User.create({
        studentId,
        fullName: parsed.fullName,
        email,
        course: parsed.course,
        phone: parsed.phone,
        passwordHash,
        role: parsed.role,
        isActive: true
      });

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: created._id,
        summary: `Provisioned ${created.role} account for ${created.fullName} (${created.studentId}).`,
        metadata: { role: created.role }
      });

      res.status(201).json({ user: serializeUser(created) });
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

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        const regex = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ action: regex }, { summary: regex }];
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
