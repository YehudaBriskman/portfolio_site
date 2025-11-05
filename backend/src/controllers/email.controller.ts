// src/controllers/email.controller.ts
import type { Request, Response } from 'express';
import type { SendPayload } from '../schemas/email.js';
import { emailService } from '../services/email.service.js';

export const EmailController = {
  send: async (req: Request<unknown, unknown, SendPayload>, res: Response) => {
    const body = req.body;
    const result = await emailService.send(body);
    return res.status(result.ok ? 200 : 502).json(result);
  }
};
