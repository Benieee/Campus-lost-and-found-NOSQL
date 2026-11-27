import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export function createAuthRateLimiter(maxOverride?: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxOverride ?? env.rateLimitAuthMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many authentication attempts. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED'
    }
  });
}

export function createClaimRateLimiter(maxOverride?: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxOverride ?? env.rateLimitClaimsMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many claim submissions in a short period. Please try again later.',
      code: 'RATE_LIMITED'
    }
  });
}
