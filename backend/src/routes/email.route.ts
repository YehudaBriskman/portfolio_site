import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { SendSchema } from '../schemas/email.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { EmailController } from '../controllers/email.controller.js';

const router = Router();

router.post(
  '/send',
  validate(SendSchema),
  asyncHandler(async (req, res) => {
    return EmailController.send(req, res);
  })
);

export default router;
