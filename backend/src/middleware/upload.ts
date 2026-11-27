import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface DetectedImage {
  ext: '.jpg' | '.png' | '.webp' | '.gif';
  mime: string;
}

/**
 * Validates actual file magic bytes instead of trusting client filenames or MIME types.
 */
export function detectImageSignature(buffer: Buffer): DetectedImage | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }

  // GIF: GIF87a or GIF89a
  const header6 = buffer.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return { ext: '.gif', mime: 'image/gif' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  return null;
}

export const imageUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1
  }
}).single('image');

export async function saveValidatedImage(file: Express.Multer.File | undefined): Promise<string> {
  if (!file) {
    throw new AppError(400, 'An image file is required.', 'IMAGE_REQUIRED');
  }

  const detected = detectImageSignature(file.buffer);
  if (!detected) {
    throw new AppError(
      400,
      'Unsupported or invalid image file. Only genuine JPEG, PNG, WebP, or GIF images up to 2 MB are allowed.',
      'INVALID_IMAGE_TYPE'
    );
  }

  await fs.mkdir(env.uploadDir, { recursive: true });
  const filename = `${crypto.randomUUID()}${detected.ext}`;
  const destination = path.join(env.uploadDir, filename);
  await fs.writeFile(destination, file.buffer, { flag: 'wx' });

  return `/uploads/${filename}`;
}
