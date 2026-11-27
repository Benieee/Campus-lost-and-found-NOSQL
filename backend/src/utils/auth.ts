import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env';
import { UserRole } from '../constants/domain';

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.bcryptRounds);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

export function signAuthToken(userId: string, role: UserRole): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn']
  };
  return jwt.sign({ sub: userId, role }, env.jwtSecret, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  if (!decoded || typeof decoded.sub !== 'string' || (decoded.role !== 'student' && decoded.role !== 'admin')) {
    throw new Error('Invalid authentication token');
  }
  return { sub: decoded.sub, role: decoded.role };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'lax' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
}
