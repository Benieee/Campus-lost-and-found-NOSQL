import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeRequest } from './middleware/sanitize';
import { createAdminRouter } from './routes/adminRoutes';
import { createAssistantRouter } from './routes/assistantRoutes';
import { createAuthRouter } from './routes/authRoutes';
import { createClaimRouter } from './routes/claimRoutes';
import { createFoundItemRouter } from './routes/foundItemRoutes';
import { createLocationRouter } from './routes/locationRoutes';
import { createLostItemRouter } from './routes/lostItemRoutes';
import { createPublicRouter } from './routes/publicRoutes';
import { createUploadRouter } from './routes/uploadRoutes';

export interface CreateAppOptions {
  authRateLimitMax?: number;
  claimRateLimitMax?: number;
  aiRateLimitMax?: number;
  aiAssistantEnabled?: boolean;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (env.isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.isProduction ? undefined : false
    })
  );

  const allowedOrigins = env.frontendOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin requests / server-to-server tools without Origin header
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS policy.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type']
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeRequest);

  // Serve validated uploaded images safely with nosniff
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      next();
    },
    express.static(env.uploadDir, { dotfiles: 'deny', index: false })
  );

  app.use('/api', createPublicRouter());
  app.use('/api/auth', createAuthRouter(options.authRateLimitMax));
  app.use('/api/uploads', createUploadRouter());
  app.use('/api/locations', createLocationRouter());
  app.use('/api/lost-items', createLostItemRouter());
  app.use('/api/found-items', createFoundItemRouter());
  app.use('/api/claims', createClaimRouter(options.claimRateLimitMax));
  app.use('/api/admin', createAdminRouter());
  app.use(
    '/api/assistant',
    createAssistantRouter({
      rateLimitMax: options.aiRateLimitMax,
      enabledOverride: options.aiAssistantEnabled
    })
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' });
  });

  // In combined deployment (e.g. Render), serve the built React SPA from ../frontend/dist
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { dotfiles: 'deny' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
