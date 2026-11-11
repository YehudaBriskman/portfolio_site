// src/controllers/email.controller.ts
import type { Request, Response } from 'express';
import type { SendPayload } from '../schemas/email.js';
import { logger } from '../logger.js';
import { emailService } from '../services/email.service.js';

export const EmailController = {
  send: async (req: Request<unknown, unknown, SendPayload>, res: Response) => {
    const body = req.body;
    const result = await emailService.send(body);
    if (result.ok) return res.status(200).json(result);
    // The provider's error text names the SMTP host and account; log it, do not return it.
    logger.error({ err: result.error }, 'email send failed');
    return res.status(502).json({ ok: false, error: 'Could not send the message right now' });
  }
};
