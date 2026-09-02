import { Router } from 'express';
import * as controller from '../controllers/requisitions.controller.js';
import { authenticateUser } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createRequisitionSchema,
  idParamSchema,
  updateRequisitionSchema,
} from '../schemas/index.js';

export const requisitionsRouter = Router();

// Authentication first; every handler then re-checks the resource itself.
requisitionsRouter.use(authenticateUser);

requisitionsRouter.get('/', controller.listRequisitions);
requisitionsRouter.get('/:id', validate(idParamSchema, 'params'), controller.getRequisition);
requisitionsRouter.post(
  '/',
  requireRole('ADMIN', 'RECRUITER'),
  validate(createRequisitionSchema),
  controller.createRequisition,
);
requisitionsRouter.patch(
  '/:id',
  requireRole('ADMIN', 'RECRUITER'),
  validate(idParamSchema, 'params'),
  validate(updateRequisitionSchema),
  controller.updateRequisition,
);
requisitionsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  controller.deleteRequisition,
);
