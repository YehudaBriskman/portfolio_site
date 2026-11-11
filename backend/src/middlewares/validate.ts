import type { RequestHandler } from 'express';
import type { z, ZodTypeAny } from 'zod';

/** Parses req.body with `schema`; the handler after it sees the parsed value, typed. */
export function validate<S extends ZodTypeAny>(schema: S): RequestHandler<unknown, unknown, z.infer<S>> {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }
    req.body = parsed.data;
    next();
  };
}
