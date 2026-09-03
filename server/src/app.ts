import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { forbidden } from './lib/errors.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());

  // Credentialed CORS must name its origins explicitly — a wildcard would let
  // any site drive the API with the user's cookie.
  //
  // A rejected origin is a deployment mistake far more often than an attack, so
  // it fails as a 403 naming the offending origin rather than an opaque 500.
  // The origin is echoed back only to the caller that already sent it, so this
  // discloses nothing it does not already know.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigin.includes(origin)) return callback(null, true);
        callback(
          forbidden(
            `Origin ${origin} is not allowed by this API's CORS policy. ` +
              'Add it to the CORS_ORIGIN environment variable.',
          ),
        );
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
