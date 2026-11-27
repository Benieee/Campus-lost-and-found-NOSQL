import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const resolvedJwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || '';

if (isProduction) {
  if (resolvedJwtSecret.length < 24) {
    throw new Error('JWT_SECRET (or SESSION_SECRET) must be set to at least 24 characters in production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set in production.');
  }
}

const origins = [
  process.env.FRONTEND_ORIGIN,
  process.env.RENDER_EXTERNAL_URL,
  !isProduction ? 'http://localhost:5173' : ''
]
  .filter(Boolean)
  .join(',');

export const env = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CampusLostFound',
  jwtSecret: resolvedJwtSecret || 'dev-only-change-before-production-bugema-lost-found-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'blf_auth_token',
  cookieSameSite: (process.env.COOKIE_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
  frontendOrigin: origins || 'http://localhost:5173',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || (isTest ? 4 : 12)),
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 15),
  rateLimitClaimsMax: Number(process.env.RATE_LIMIT_CLAIMS_MAX || 20),
  rateLimitAiMax: Number(process.env.RATE_LIMIT_AI_MAX || 30),
  aiAssistantEnabled: process.env.AI_ASSISTANT_ENABLED !== 'false',
  aiProviderApiKey: process.env.AI_PROVIDER_API_KEY || '',
  aiProviderBaseUrl: (process.env.AI_PROVIDER_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  aiProviderModel: process.env.AI_PROVIDER_MODEL || 'gpt-4o-mini'
};
