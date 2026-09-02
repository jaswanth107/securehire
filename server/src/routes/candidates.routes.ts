import { Router } from 'express';
import * as candidates from '../controllers/candidates.controller.js';
import * as assignments from '../controllers/assignments.controller.js';
import * as feedback from '../controllers/feedback.controller.js';
import { authenticateUser } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  assignPanelistSchema,
  assignmentParamsSchema,
  candidateIdParamSchema,
  createCandidateSchema,
  feedbackSchema,
  idParamSchema,
  listCandidatesQuerySchema,
  updateCandidateSchema,
} from '../schemas/index.js';

export const candidatesRouter = Router();

candidatesRouter.use(authenticateUser);

candidatesRouter.get('/', validate(listCandidatesQuerySchema, 'query'), candidates.listCandidates);
candidatesRouter.get('/:id', validate(idParamSchema, 'params'), candidates.getCandidate);
candidatesRouter.post(
  '/',
  requireRole('ADMIN', 'RECRUITER'),
  validate(createCandidateSchema),
  candidates.createCandidate,
);
candidatesRouter.patch(
  '/:id',
  requireRole('ADMIN', 'RECRUITER'),
  validate(idParamSchema, 'params'),
  validate(updateCandidateSchema),
  candidates.updateCandidate,
);
candidatesRouter.delete(
  '/:id',
  requireRole('ADMIN', 'RECRUITER'),
  validate(idParamSchema, 'params'),
  candidates.deleteCandidate,
);

/* --- Panelist assignments (owner-managed) --------------------------------- */

candidatesRouter.get(
  '/:candidateId/panelists',
  validate(candidateIdParamSchema, 'params'),
  assignments.listCandidatePanelists,
);
candidatesRouter.post(
  '/:candidateId/panelists',
  requireRole('ADMIN', 'RECRUITER'),
  validate(candidateIdParamSchema, 'params'),
  validate(assignPanelistSchema),
  assignments.assignPanelist,
);
candidatesRouter.delete(
  '/:candidateId/panelists/:panelistId',
  requireRole('ADMIN', 'RECRUITER'),
  validate(assignmentParamsSchema, 'params'),
  assignments.removePanelist,
);

/* --- Interview feedback --------------------------------------------------- */

candidatesRouter.get(
  '/:candidateId/feedback',
  validate(candidateIdParamSchema, 'params'),
  feedback.listFeedback,
);
candidatesRouter.post(
  '/:candidateId/feedback',
  requireRole('ADMIN', 'PANELIST'),
  validate(candidateIdParamSchema, 'params'),
  validate(feedbackSchema),
  feedback.submitFeedback,
);
