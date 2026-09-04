import { Router } from 'express';
import * as controller from '../controllers/activity.controller.js';
import { authenticateUser } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { listActivityQuerySchema } from '../schemas/index.js';

export const activityRouter = Router();

// Every role may read the feed; what each one is shown is decided by
// `activityScopeWhere` and the viewer-aware presenter, not by a route gate.
activityRouter.use(authenticateUser);

activityRouter.get('/unread', controller.unreadCount);
activityRouter.post('/read', controller.markRead);
activityRouter.get('/', validate(listActivityQuerySchema, 'query'), controller.listActivity);
