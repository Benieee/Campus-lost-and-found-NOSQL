import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { imageUploadMiddleware, saveValidatedImage } from '../middleware/upload';

export function createUploadRouter() {
  const router = Router();

  router.post('/image', requireAuth, (req, res, next) => {
    imageUploadMiddleware(req, res, (err) => {
      if (err) return next(err);
      saveValidatedImage(req.file)
        .then((imageUrl) => {
          res.status(201).json({ imageUrl });
        })
        .catch(next);
    });
  });

  return router;
}
