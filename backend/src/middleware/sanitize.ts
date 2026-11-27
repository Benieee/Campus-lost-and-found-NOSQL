import { NextFunction, Request, Response } from 'express';

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      clean[key] = sanitizeValue(entry);
    }
    return clean;
  }
  return value;
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as Request['query'];
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params) as Request['params'];
  }
  next();
}
