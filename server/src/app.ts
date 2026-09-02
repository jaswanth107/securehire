import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());

  // Credentialed CORS must name its origins explicitly — a wildcard would let
  // any site drive the API with the user's cookie.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigin.includes(origin)) return callback(null, true);
        callback(new Error('Origin not allowed by CORS policy.'));
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Preview-As-User'],
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.disableRateLimit ? 1_000_000 : 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' },
      },
    }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
