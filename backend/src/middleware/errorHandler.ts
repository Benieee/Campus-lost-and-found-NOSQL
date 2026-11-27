import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {})
    });
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'body';
      fieldErrors[key] = fieldErrors[key] || [];
      fieldErrors[key].push(issue.message);
    }
    res.status(400).json({
      error: err.issues[0]?.message || 'Please check the submitted information and try again.',
      code: 'VALIDATION_ERROR',
      details: fieldErrors
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image exceeds the maximum allowed size of 2 MB.'
        : 'Unable to process uploaded image.';
    res.status(400).json({ error: message, code: 'UPLOAD_ERROR' });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: 'Invalid record identifier.', code: 'INVALID_ID' });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: 'Submitted data failed validation.', code: 'VALIDATION_ERROR' });
    return;
  }

  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'A record with those unique details already exists.', code: 'DUPLICATE_RECORD' });
    return;
  }

  if (!env.isTest) {
    // Log only non-sensitive error metadata (never request bodies, tokens, passwords, or claim proof)
    const errName = err instanceof Error ? err.name : 'UnknownError';
    const errMessage = err instanceof Error ? err.message : 'Unexpected failure';
    console.error(`[API Error] ${errName}: ${errMessage}`);
  }

  res.status(500).json({
    error: 'An unexpected error occurred while processing your request.',
    code: 'INTERNAL_ERROR'
  });
}
