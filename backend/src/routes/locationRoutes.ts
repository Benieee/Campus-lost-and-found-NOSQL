import { Router } from 'express';
import { FoundItem, Location, LostItem } from '../models';
import { attachOptionalUser, requireAdmin } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { AppError } from '../utils/errors';
import { assertObjectId, createLocationSchema, updateLocationSchema } from '../utils/validation';

export function createLocationRouter() {
  const router = Router();

  router.get('/', attachOptionalUser, async (req, res, next) => {
    try {
      const includeInactive = req.user?.role === 'admin' && req.query.includeInactive === 'true';
      const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
      if (req.query.holdingOnly === 'true') {
        filter.isHoldingDesk = true;
      }

      const locations = await Location.find(filter).sort({ name: 1 }).lean();
      res.json({
        locations: locations.map((loc) => ({
          id: String(loc._id),
          name: loc.name,
          code: loc.code,
          buildingArea: loc.buildingArea,
          isHoldingDesk: loc.isHoldingDesk,
          description: loc.description,
          isActive: loc.isActive,
          createdAt: loc.createdAt,
          updatedAt: loc.updatedAt
        }))
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const parsed = createLocationSchema.parse(req.body);
      const location = await Location.create({
        ...parsed,
        code: parsed.code.toUpperCase()
      });

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'LOCATION_CREATED',
        entityType: 'Location',
        entityId: location._id,
        summary: `Added campus location "${location.name}" (${location.code}).`
      });

      res.status(201).json({
        location: {
          id: String(location._id),
          name: location.name,
          code: location.code,
          buildingArea: location.buildingArea,
          isHoldingDesk: location.isHoldingDesk,
          description: location.description,
          isActive: location.isActive,
          createdAt: location.createdAt,
          updatedAt: location.updatedAt
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireAdmin, async (req, res, next) => {
    try {
      const locationId = assertObjectId(req.params.id, 'location ID');
      const parsed = updateLocationSchema.parse(req.body);
      const updates = {
        ...parsed,
        ...(parsed.code ? { code: parsed.code.toUpperCase() } : {})
      };

      const updated = await Location.findByIdAndUpdate(
        locationId,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        throw new AppError(404, 'Campus location not found.', 'NOT_FOUND');
      }

      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'LOCATION_UPDATED',
        entityType: 'Location',
        entityId: updated._id,
        summary: `Updated campus location "${updated.name}".`,
        metadata: { isActive: updated.isActive, isHoldingDesk: updated.isHoldingDesk }
      });

      res.json({
        location: {
          id: String(updated._id),
          name: updated.name,
          code: updated.code,
          buildingArea: updated.buildingArea,
          isHoldingDesk: updated.isHoldingDesk,
          description: updated.description,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
      const locationId = assertObjectId(req.params.id, 'location ID');
      const existing = await Location.findById(locationId);
      if (!existing) {
        throw new AppError(404, 'Campus location not found.', 'NOT_FOUND');
      }

      const [lostCount, foundCount] = await Promise.all([
        LostItem.countDocuments({ locationRef: locationId }),
        FoundItem.countDocuments({ locationRef: locationId })
      ]);

      if (lostCount > 0 || foundCount > 0) {
        existing.isActive = false;
        await existing.save();
        await recordAuditLog({
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action: 'LOCATION_DEACTIVATED',
          entityType: 'Location',
          entityId: existing._id,
          summary: `Deactivated referenced campus location "${existing.name}".`
        });
        res.json({ message: 'Location is linked to existing reports and was deactivated instead of deleted.', deactivated: true });
        return;
      }

      await existing.deleteOne();
      await recordAuditLog({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'LOCATION_DELETED',
        entityType: 'Location',
        entityId: existing._id,
        summary: `Removed unused campus location "${existing.name}".`
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
