// src/middlewares/validate.ts
import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

export function validate<T extends ZodSchema>(schema: T): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }
    (req as unknown as { body: unknown }).body = parsed.data;
    next();
  };
}
