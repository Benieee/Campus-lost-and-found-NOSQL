import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { generateAssistantReply, STAFF_CONTACT_INFO } from '../services/aiAssistantService';

const chatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, 'Please enter a question or item description (at least 2 characters).')
    .max(800, 'Please keep your message under 800 characters.'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().max(800)
      })
    )
    .max(8)
    .optional()
    .default([])
});

export interface AssistantRouterOptions {
  rateLimitMax?: number;
  enabledOverride?: boolean;
}

export function createAssistantRouter(options: AssistantRouterOptions = {}) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: options.rateLimitMax ?? env.rateLimitAiMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many assistant requests in a short time. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED'
    }
  });

  router.get('/status', (_req, res) => {
    const available = options.enabledOverride ?? env.aiAssistantEnabled;
    res.json({
      available,
      staffContact: STAFF_CONTACT_INFO,
      privacySummary:
        'AI responses are clearly labeled and use only publicly visible found-item summaries. Passwords, tokens, private student records, and hidden item details are never accessed or used for model training.'
    });
  });

  router.post('/chat', limiter, async (req, res, next) => {
    try {
      const parsed = chatSchema.parse(req.body);
      const result = await generateAssistantReply(parsed.message, parsed.history, {
        enabledOverride: options.enabledOverride
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
