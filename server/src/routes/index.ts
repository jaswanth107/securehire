import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { candidatesRouter } from './candidates.routes.js';
import { requisitionsRouter } from './requisitions.routes.js';
import { previewRouter, usersRouter } from './users.routes.js';
import { authenticateUser } from '../middleware/authenticate.js';
import { dashboardStats } from '../controllers/stats.controller.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/requisitions', requisitionsRouter);
apiRouter.use('/candidates', candidatesRouter);
apiRouter.use('/preview', previewRouter);
apiRouter.get('/stats/dashboard', authenticateUser, dashboardStats);
