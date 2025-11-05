// src/routes/email.routes.ts
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { SendSchema } from '../schemas/email.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

router.post(
  '/send',
  validate(SendSchema),
  asyncHandler(async (req, res) => {
    const { EmailController } = await import('../controllers/email.controller.js');
    return EmailController.send(req, res);
  })
);

export default router;
