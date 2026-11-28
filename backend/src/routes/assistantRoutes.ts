import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import {
  generateAssistantReply,
  STAFF_CONTACT_INFO,
  streamAssistantReply
} from '../services/aiAssistantService';
import { AppError } from '../utils/errors';

const chatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Please enter a question or item description.')
    .max(800, 'Please keep your message under 800 characters.'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().max(800)
      })
    )
    .max(10)
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
      streamingSupported: true,
      providerMode: env.aiProviderApiKey ? 'external_llm' : 'campus_assistant',
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

  router.post('/stream', limiter, async (req, res, next) => {
    const isEnabled = options.enabledOverride ?? env.aiAssistantEnabled;
    if (!isEnabled) {
      next(
        new AppError(
          503,
          'The AI support assistant is temporarily unavailable. You can still browse found items, submit a lost report, or file a claim directly.',
          'AI_UNAVAILABLE'
        )
      );
      return;
    }

    let parsed: z.infer<typeof chatSchema>;
    try {
      parsed = chatSchema.parse(req.body);
    } catch (err) {
      next(err);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const writeEvent = (event: string, data: unknown) => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await streamAssistantReply(
        parsed.message,
        parsed.history,
        {
          onStatus: (text) => writeEvent('status', { text }),
          onToken: (text) => writeEvent('token', { text })
        },
        { enabledOverride: options.enabledOverride }
      );
      writeEvent('done', result);
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : 'Unable to complete response right now. Please try again.';
      const code = err instanceof AppError ? err.code : 'AI_STREAM_ERROR';
      writeEvent('error', { error: message, code });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  return router;
}
