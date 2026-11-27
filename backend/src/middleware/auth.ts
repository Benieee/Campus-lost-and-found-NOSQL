import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { UserRole } from '../constants/domain';
import { User } from '../models';
import { clearAuthCookie, verifyAuthToken } from '../utils/auth';
import { AppError } from '../utils/errors';

export interface AuthenticatedUser {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  course: string;
  phone: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

async function resolveUserFromRequest(req: Request, res: Response): Promise<AuthenticatedUser | undefined> {
  const token = req.cookies?.[env.cookieName];
  if (!token || typeof token !== 'string') {
    return undefined;
  }

  try {
    const payload = verifyAuthToken(token);
    const dbUser = await User.findById(payload.sub).lean();
    if (!dbUser || !dbUser.isActive) {
      clearAuthCookie(res);
      return undefined;
    }
    return {
      id: String(dbUser._id),
      studentId: dbUser.studentId,
      fullName: dbUser.fullName,
      email: dbUser.email,
      course: dbUser.course,
      phone: dbUser.phone,
      role: dbUser.role
    };
  } catch {
    clearAuthCookie(res);
    return undefined;
  }
}

export function attachOptionalUser(req: Request, res: Response, next: NextFunction): void {
  resolveUserFromRequest(req, res)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  resolveUserFromRequest(req, res)
    .then((user) => {
      if (!user) {
        return next(new AppError(401, 'Authentication required. Please sign in to continue.', 'UNAUTHORIZED'));
      }
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user?.role !== 'admin') {
      return next(new AppError(403, 'Administrator or staff authorization is required.', 'FORBIDDEN'));
    }
    next();
  });
}
