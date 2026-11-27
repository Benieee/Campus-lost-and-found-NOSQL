import { Router } from 'express';
import { FilterQuery } from 'mongoose';
import {
  FLAG_REPORT_REASONS,
  FLAG_REPORT_STATUSES,
  FLAG_REPORT_TARGETS
} from '../constants/domain';
import { Claim, FlagReport, FoundItem, IFlagReport, LostItem } from '../models';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { AppError } from '../utils/errors';
import { serializeFlagReport } from '../utils/serializers';
import {
  assertObjectId,
  createFlagReportSchema,
  parsePagination,
  reviewFlagReportSchema
} from '../utils/validation';

export function createReportRouter() {
  const router = Router();

  // Authenticated users or staff can flag inaccurate listings, duplicates, inappropriate content, privacy risks, or suspicious claims
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const parsed = createFlagReportSchema.parse(req.body);
      const targetId = assertObjectId(parsed.targetId, `${parsed.targetType} ID`);

      let targetLabel = '';
      if (parsed.targetType === 'LostItem') {
        const item = await LostItem.findById(targetId).lean();
        if (!item) throw new AppError(404, 'Lost-item listing not found.', 'NOT_FOUND');
        targetLabel = item.itemName;
      } else if (parsed.targetType === 'FoundItem') {
        const item = await FoundItem.findById(targetId).lean();
        if (!item) throw new AppError(404, 'Found-item listing not found.', 'NOT_FOUND');
        targetLabel = item.itemName;
      } else {
        const claim = await Claim.findById(targetId).lean();
        if (!claim) throw new AppError(404, 'Claim record not found.', 'NOT_FOUND');
        if (req.user!.role !== 'admin' && String(claim.claimant) !== req.user!.id) {
          throw new AppError(403, 'Only authorized staff may flag another user’s claim.', 'FORBIDDEN');
        }
        targetLabel = `Claim ${claim.referenceCode}`;
      }

      const report = await FlagReport.create({
        targetType: parsed.targetType,
        targetId,
        targetLabel,
        reason: parsed.reason,
        details: parsed.details,
        reportedBy: assertObjectId(req.user!.id, 'user ID'),
        status: 'Open'
      });

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'FLAG_REPORT_CREATED',
        entityType: 'FlagReport',
        entityId: report._id,
        summary: `Flagged ${parsed.targetType} "${targetLabel}" for ${parsed.reason}.`,
        metadata: { targetType: parsed.targetType, targetId: String(targetId), reason: parsed.reason }
      });

      const populated = await FlagReport.findById(report._id)
        .populate('reportedBy', 'fullName studentId email role')
        .lean();

      res.status(201).json({ report: serializeFlagReport(populated) });
    } catch (err) {
      next(err);
    }
  });

  // Admin-only moderation queue
  router.get('/', requireAdmin, async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const filter: FilterQuery<IFlagReport> = {};

      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      if (status && (FLAG_REPORT_STATUSES as readonly string[]).includes(status)) {
        filter.status = status;
      }

      const reason = typeof req.query.reason === 'string' ? req.query.reason.trim() : '';
      if (reason && (FLAG_REPORT_REASONS as readonly string[]).includes(reason)) {
        filter.reason = reason;
      }

      const targetType = typeof req.query.targetType === 'string' ? req.query.targetType.trim() : '';
      if (targetType && (FLAG_REPORT_TARGETS as readonly string[]).includes(targetType)) {
        filter.targetType = targetType;
      }

      const [reports, total] = await Promise.all([
        FlagReport.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('reportedBy', 'fullName studentId email role')
          .populate('resolvedBy', 'fullName role')
          .lean(),
        FlagReport.countDocuments(filter)
      ]);

      res.json({
        reports: reports.map(serializeFlagReport),
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

  // Admin-only resolution of flagged reports
  router.patch('/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'report ID');
      const parsed = reviewFlagReportSchema.parse(req.body);

      const report = await FlagReport.findById(id);
      if (!report) {
        throw new AppError(404, 'Flag report not found.', 'NOT_FOUND');
      }

      const previousStatus = report.status;
      report.status = parsed.status;
      report.resolutionNotes = parsed.resolutionNotes;
      if (parsed.actionTaken !== undefined) {
        report.actionTaken = parsed.actionTaken;
      }
      report.resolvedBy = assertObjectId(req.user!.id, 'resolver ID');
      report.resolvedAt = new Date();

      await report.save();

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: `FLAG_REPORT_${parsed.status.toUpperCase()}`,
        entityType: 'FlagReport',
        entityId: report._id,
        summary: `Flag report on "${report.targetLabel}" (${report.reason}) changed from ${previousStatus} to ${report.status}.`,
        metadata: {
          previousStatus,
          newStatus: report.status,
          targetType: report.targetType,
          targetId: String(report.targetId),
          actionTaken: report.actionTaken
        }
      });

      const populated = await FlagReport.findById(report._id)
        .populate('reportedBy', 'fullName studentId email role')
        .populate('resolvedBy', 'fullName role')
        .lean();

      res.json({ report: serializeFlagReport(populated) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
