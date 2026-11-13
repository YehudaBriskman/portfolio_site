import type { Request, Response } from 'express';
import type { SendPayload } from '../schemas/email.js';
import { logger } from '../logger.js';
import { emailService } from '../services/email.service.js';
import { allowMessage } from '../services/contactGuard.js';

/* One answer for sent, dropped by a limit and caught by the honeypot: a bot learns nothing from it. */
const ACCEPTED = { ok: true } as const;

export const EmailController = {
  send: async (req: Request<unknown, unknown, SendPayload>, res: Response) => {
    const { website, ...body } = req.body;
    // A person leaves the hidden field empty; nothing is sent and nothing is counted.
    if (website) return res.status(200).json(ACCEPTED);
    if (!allowMessage(req.ip ?? '')) {
      logger.warn('contact form rate limit reached; message dropped');
      return res.status(200).json(ACCEPTED);
    }
    const result = await emailService.send(body as SendPayload, { publicForm: true });
    if (result.ok) return res.status(200).json(ACCEPTED);
    // The provider's error text names the SMTP host and account; log it, do not return it.
    logger.error({ err: result.error }, 'email send failed');
    return res.status(502).json({ ok: false, error: 'Could not send the message right now' });
  }
};
