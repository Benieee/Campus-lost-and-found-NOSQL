import { Router } from 'express';
import { User } from '../models';
import { attachOptionalUser, requireAuth } from '../middleware/auth';
import { createAuthRateLimiter } from '../middleware/rateLimit';
import { recordAuditLog } from '../services/auditService';
import { clearAuthCookie, hashPassword, setAuthCookie, signAuthToken, verifyPassword } from '../utils/auth';
import { AppError } from '../utils/errors';
import { serializeUser } from '../utils/serializers';
import { loginSchema, registerSchema, updateProfileSchema } from '../utils/validation';

export function createAuthRouter(rateLimitMax?: number) {
  const router = Router();
  const authLimiter = createAuthRateLimiter(rateLimitMax);

  router.post('/register', authLimiter, async (req, res, next) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const email = parsed.email.toLowerCase();
      const studentId = parsed.studentId.toUpperCase();

      const existing = await User.findOne({
        $or: [{ email }, { studentId }]
      }).lean();

      if (existing) {
        throw new AppError(409, 'An account with that email address or student ID already exists.', 'DUPLICATE_ACCOUNT');
      }

      const passwordHash = await hashPassword(parsed.password);
      const user = await User.create({
        studentId,
        fullName: parsed.fullName,
        email,
        course: parsed.course,
        phone: parsed.phone,
        passwordHash,
        role: 'student',
        isActive: true
      });

      const token = signAuthToken(String(user._id), user.role);
      setAuthCookie(res, token);

      await recordAuditLog({
        actorId: user._id,
        actorRole: user.role,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user._id,
        summary: `New student account registered (${user.studentId}).`
      });

      res.status(201).json({ user: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', authLimiter, async (req, res, next) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const email = parsed.email.toLowerCase();

      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user || !user.isActive) {
        throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
      }

      const passwordValid = await verifyPassword(parsed.password, user.passwordHash);
      if (!passwordValid) {
        throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
      }

      const token = signAuthToken(String(user._id), user.role);
      setAuthCookie(res, token);

      res.json({ user: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (_req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
  });

  router.get('/me', attachOptionalUser, async (req, res, next) => {
    try {
      if (!req.user) {
        res.json({ user: null });
        return;
      }
      const user = await User.findById(req.user.id).lean();
      res.json({ user: user ? serializeUser(user) : null });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/profile', requireAuth, async (req, res, next) => {
    try {
      const parsed = updateProfileSchema.parse(req.body);
      const updated = await User.findByIdAndUpdate(
        req.user!.id,
        { $set: parsed },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        throw new AppError(404, 'Account not found.', 'NOT_FOUND');
      }

      res.json({ user: serializeUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
