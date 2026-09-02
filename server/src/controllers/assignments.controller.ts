import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serializeUser } from '../lib/presenters.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { authorizeCandidateAccess } from '../services/authorization.service.js';

/**
 * GET /api/candidates/:candidateId/panelists
 *
 * Managing the panel is an owner operation, so the `assign` action is used:
 * panelists cannot enumerate the rest of the interview panel.
 */
export const listCandidatePanelists = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.candidateId!, 'assign');

  const assignments = await prisma.candidatePanelistAssignment.findMany({
    where: { candidateId: candidate.id },
    include: { panelist: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { assignedAt: 'asc' },
  });

  res.json({
    success: true,
    data: assignments.map((a) => ({
      assignmentId: a.id,
      assignedAt: a.assignedAt,
      ...serializeUser(a.panelist),
    })),
  });
});

/** POST /api/candidates/:candidateId/panelists */
export const assignPanelist = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  // Ownership of the *candidate* is what grants the right to assign. A recruiter
  // therefore cannot attach a panelist to another recruiter's candidate, and
  // cannot use this route to grant themselves access to one.
  const candidate = await authorizeCandidateAccess(user, req.params.candidateId!, 'assign');
  const { panelistId } = req.body as { panelistId: string };

  const panelist = await prisma.user.findUnique({
    where: { id: panelistId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!panelist || panelist.role !== 'PANELIST' || !panelist.isActive) {
    throw badRequest('panelistId must reference an active panelist.');
  }

  try {
    const assignment = await prisma.candidatePanelistAssignment.create({
      data: { candidateId: candidate.id, panelistId: panelist.id },
    });
    res.status(201).json({
      success: true,
      data: { assignmentId: assignment.id, assignedAt: assignment.assignedAt, ...serializeUser(panelist) },
    });
  } catch (error) {
    // The UNIQUE(candidateId, panelistId) constraint makes concurrent duplicate
    // assignment requests safe: one wins, the rest surface as a conflict.
    if ((error as { code?: string }).code === 'P2002') {
      throw conflict('That panelist is already assigned to this candidate.');
    }
    throw error;
  }
});

/** DELETE /api/candidates/:candidateId/panelists/:panelistId */
export const removePanelist = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.candidateId!, 'assign');
  const panelistId = req.params.panelistId!;

  const result = await prisma.candidatePanelistAssignment.deleteMany({
    where: { candidateId: candidate.id, panelistId },
  });
  if (result.count === 0) throw notFound('That panelist is not assigned to this candidate.');

  res.json({ success: true, data: { candidateId: candidate.id, panelistId } });
});
