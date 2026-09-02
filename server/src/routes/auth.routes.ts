import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { authenticateUser } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/index.js';
import { env } from '../config/env.js';

// Credential endpoints are the ones worth throttling: they are the only
// unauthenticated write surface in the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.disableRateLimit ? 100000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' },
  },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticateUser, authController.me);
