import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set in production.');
  }
}

export const env = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CampusLostFound',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-before-production-bugema-lost-found-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'blf_auth_token',
  cookieSameSite: (process.env.COOKIE_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || (isTest ? 4 : 12)),
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 15),
  rateLimitClaimsMax: Number(process.env.RATE_LIMIT_CLAIMS_MAX || 20)
};
