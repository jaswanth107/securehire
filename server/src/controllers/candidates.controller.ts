import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serializeCandidate, serializeUser } from '../lib/presenters.js';
import {
  authorizeCandidateAccess,
  authorizeRequisitionTarget,
  candidateScopeWhere,
} from '../services/authorization.service.js';

const CANDIDATE_INCLUDE = {
  requisition: { select: { id: true, title: true, department: true, recruiterId: true } },
} satisfies Prisma.CandidateInclude;

/**
 * GET /api/candidates
 *
 * The role scope is part of the SQL `where`, so the database never returns a
 * row this user may not see. Query-string filters are ANDed *inside* that
 * scope — they can narrow the result set, never widen it.
 */
export const listCandidates = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { requisitionId, status, search } = req.query as {
    requisitionId?: string;
    status?: Prisma.CandidateWhereInput['status'];
    search?: string;
  };

  const filters: Prisma.CandidateWhereInput = {};
  if (requisitionId) filters.requisitionId = requisitionId;
  if (status) filters.status = status;
  if (search) filters.name = { contains: search, mode: 'insensitive' };

  const candidates = await prisma.candidate.findMany({
    where: { AND: [candidateScopeWhere(user), filters] },
    include: CANDIDATE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: candidates.map((candidate) => serializeCandidate(candidate, user)),
  });
});

/** GET /api/candidates/:id */
export const getCandidate = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.id!, 'read');

  const payload: Record<string, unknown> = serializeCandidate(candidate, user);

  if (user.role === 'PANELIST') {
    // A panelist sees only their own feedback, not the rest of the panel's.
    const ownFeedback = await prisma.interviewFeedback.findUnique({
      where: { candidateId_panelistId: { candidateId: candidate.id, panelistId: user.id } },
    });
    payload.myFeedback = ownFeedback;
  } else {
    const [assignments, feedback] = await Promise.all([
      prisma.candidatePanelistAssignment.findMany({
        where: { candidateId: candidate.id },
        include: { panelist: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { assignedAt: 'asc' },
      }),
      prisma.interviewFeedback.findMany({
        where: { candidateId: candidate.id },
        include: { panelist: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    payload.panelists = assignments.map((a) => ({
      assignmentId: a.id,
      assignedAt: a.assignedAt,
      ...serializeUser(a.panelist),
    }));
    payload.feedback = feedback.map((f) => ({
      id: f.id,
      rating: f.rating,
      feedback: f.feedback,
      createdAt: f.createdAt,
      panelist: serializeUser(f.panelist),
    }));
  }

  res.json({ success: true, data: payload });
});

/** POST /api/candidates — admins anywhere, recruiters only inside their own requisitions. */
export const createCandidate = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const body = req.body as {
    name: string;
    email: string;
    phone: string;
    status?: Prisma.CandidateCreateInput['status'];
    notes?: string;
    requisitionId: string;
  };

  await authorizeRequisitionTarget(user, body.requisitionId);

  const candidate = await prisma.candidate.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      status: body.status ?? 'APPLIED',
      notes: body.notes ?? null,
      requisitionId: body.requisitionId,
    },
    include: CANDIDATE_INCLUDE,
  });

  res.status(201).json({ success: true, data: serializeCandidate(candidate, user) });
});

/** PATCH /api/candidates/:id */
export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const existing = await authorizeCandidateAccess(user, req.params.id!, 'update');
  const body = req.body as Partial<{
    name: string;
    email: string;
    phone: string;
    status: Prisma.CandidateUpdateInput['status'];
    notes: string;
    requisitionId: string;
  }>;

  // Moving a candidate between requisitions is an ownership change: the target
  // requisition must also belong to the caller, so a recruiter cannot push a
  // candidate into (or pull one out of) another recruiter's tenancy.
  if (body.requisitionId && body.requisitionId !== existing.requisitionId) {
    await authorizeRequisitionTarget(user, body.requisitionId);
  }

  const candidate = await prisma.candidate.update({
    where: { id: existing.id },
    data: {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.email === undefined ? {} : { email: body.email }),
      ...(body.phone === undefined ? {} : { phone: body.phone }),
      ...(body.status === undefined ? {} : { status: body.status }),
      ...(body.notes === undefined ? {} : { notes: body.notes }),
      ...(body.requisitionId === undefined ? {} : { requisitionId: body.requisitionId }),
    },
    include: CANDIDATE_INCLUDE,
  });

  res.json({ success: true, data: serializeCandidate(candidate, user) });
});

/** DELETE /api/candidates/:id */
export const deleteCandidate = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.id!, 'delete');
  await prisma.candidate.delete({ where: { id: candidate.id } });
  res.json({ success: true, data: { id: candidate.id } });
});
