import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serializeCandidate, serializeUser } from '../lib/presenters.js';
import { recordEvent, recordEvents, type ActivityInput } from '../lib/activity.js';
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

  // The candidate and its audit entry are written together: a rolled-back
  // create must not leave an event claiming it happened.
  const candidate = await prisma.$transaction(async (tx) => {
    const created = await tx.candidate.create({
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

    await recordEvent(tx, req, {
      action: 'CANDIDATE_CREATED',
      recruiterId: created.requisition.recruiterId,
      requisitionId: created.requisitionId,
      requisitionTitle: created.requisition.title,
      candidateId: created.id,
      candidateName: created.name,
      detail: { status: created.status },
    });

    return created;
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

  const candidate = await prisma.$transaction(async (tx) => {
    const updated = await tx.candidate.update({
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

    // A status move is the entry a reviewer actually looks for, so it is logged
    // as its own action rather than buried inside a generic "updated".
    const events: ActivityInput[] = [];
    const context = {
      recruiterId: updated.requisition.recruiterId,
      requisitionId: updated.requisitionId,
      requisitionTitle: updated.requisition.title,
      candidateId: updated.id,
      candidateName: updated.name,
    };

    if (updated.status !== existing.status) {
      events.push({
        action: 'CANDIDATE_STATUS_CHANGED',
        ...context,
        detail: { from: existing.status, to: updated.status },
      });
    }

    // Which fields moved — never the values, which include contact details.
    const changed = (['name', 'email', 'phone', 'notes', 'requisitionId'] as const).filter(
      (field) => body[field] !== undefined && body[field] !== existing[field],
    );
    if (changed.length > 0) {
      events.push({ action: 'CANDIDATE_UPDATED', ...context, detail: { fields: changed } });
    }

    await recordEvents(tx, req, events);
    return updated;
  });

  res.json({ success: true, data: serializeCandidate(candidate, user) });
});

/** DELETE /api/candidates/:id */
export const deleteCandidate = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.id!, 'delete');

  await prisma.$transaction(async (tx) => {
    await tx.candidate.delete({ where: { id: candidate.id } });
    // Written after the delete and outside any relation, so the row survives
    // the cascade that just removed the candidate it describes.
    await recordEvent(tx, req, {
      action: 'CANDIDATE_DELETED',
      recruiterId: candidate.requisition.recruiterId,
      requisitionId: candidate.requisitionId,
      requisitionTitle: candidate.requisition.title,
      candidateId: candidate.id,
      candidateName: candidate.name,
    });
  });
  res.json({ success: true, data: { id: candidate.id } });
});
