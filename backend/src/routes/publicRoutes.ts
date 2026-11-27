import { Router } from 'express';
import mongoose from 'mongoose';
import { FoundItem, LostItem } from '../models';
import { attachOptionalUser } from '../middleware/auth';
import { findSuggestedMatchesForFoundItem, findSuggestedMatchesForLostItem } from '../services/matchingService';
import { AppError } from '../utils/errors';
import { assertObjectId } from '../utils/validation';

export function createPublicRouter() {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    res.status(dbReady ? 200 : 503).json({
      status: dbReady ? 'ok' : 'degraded',
      database: dbReady ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/public/summary', async (_req, res, next) => {
    try {
      const [openLostReports, foundInStorage, returnedItems] = await Promise.all([
        LostItem.countDocuments({ status: { $in: ['Missing', 'Matched'] } }),
        FoundItem.countDocuments({ status: { $in: ['Stored', 'Claim Pending'] } }),
        FoundItem.countDocuments({ status: 'Returned' })
      ]);

      res.json({
        counts: {
          openLostReports,
          foundInStorage,
          returnedItems
        },
        projectNotice:
          'Proposed student project for Bugema University using fictional demonstration data. Not an officially deployed university system.'
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/matches/lost/:id', attachOptionalUser, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'lost item ID');
      const item = await LostItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Lost-item report not found.', 'NOT_FOUND');
      }
      const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
      const result = await findSuggestedMatchesForLostItem(item, viewer, 5);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/matches/found/:id', attachOptionalUser, async (req, res, next) => {
    try {
      const id = assertObjectId(req.params.id, 'found item ID');
      const item = await FoundItem.findById(id);
      if (!item) {
        throw new AppError(404, 'Found item not found.', 'NOT_FOUND');
      }
      const viewer = req.user ? { id: req.user.id, role: req.user.role } : null;
      const result = await findSuggestedMatchesForFoundItem(item, viewer, 5);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
