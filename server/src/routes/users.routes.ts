import { Router } from 'express';
import * as controller from '../controllers/users.controller.js';
import { authenticateUser } from '../middleware/authenticate.js';
import { requireAdmin, requireAuthenticatedAdmin } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema, listUsersQuerySchema } from '../schemas/index.js';

export const usersRouter = Router();
usersRouter.use(authenticateUser);

// Declared before `/:id` style routes so the literal path wins.
usersRouter.get('/panelists', controller.listPanelists);
usersRouter.get('/', requireAdmin, validate(listUsersQuerySchema, 'query'), controller.listUsers);
usersRouter.patch('/:id', requireAdmin, validate(idParamSchema, 'params'), controller.updateUser);

export const previewRouter = Router();
previewRouter.use(authenticateUser);
// Gated on the authenticated admin, not the effective user, so an admin who is
// mid-preview can still switch target or exit.
previewRouter.get('/users', requireAuthenticatedAdmin, controller.listPreviewUsers);
