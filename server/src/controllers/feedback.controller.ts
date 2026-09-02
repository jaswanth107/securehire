import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serializeUser } from '../lib/presenters.js';
import { authorizeCandidateAccess } from '../services/authorization.service.js';

/** GET /api/candidates/:candidateId/feedback */
export const listFeedback = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.candidateId!, 'read');

  // A panelist reads back only their own submission; the recruiter and admin
  // see the whole panel's scoring.
  const where =
    user.role === 'PANELIST'
      ? { candidateId: candidate.id, panelistId: user.id }
      : { candidateId: candidate.id };

  const feedback = await prisma.interviewFeedback.findMany({
    where,
    include: { panelist: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: feedback.map((f) => ({
      id: f.id,
      rating: f.rating,
      feedback: f.feedback,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      panelist: serializeUser(f.panelist),
    })),
  });
});

/**
 * POST /api/candidates/:candidateId/feedback
 *
 * The `feedback` action resolves to "assignment record exists" for a panelist,
 * so feedback can only ever be filed against a candidate they were assigned.
 * Re-submitting updates the author's own entry rather than creating a second.
 */
export const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidate = await authorizeCandidateAccess(user, req.params.candidateId!, 'feedback');
  const { rating, feedback } = req.body as { rating: number; feedback: string };

  const saved = await prisma.interviewFeedback.upsert({
    where: { candidateId_panelistId: { candidateId: candidate.id, panelistId: user.id } },
    create: { candidateId: candidate.id, panelistId: user.id, rating, feedback },
    update: { rating, feedback },
    include: { panelist: { select: { id: true, name: true, email: true, role: true } } },
  });

  res.status(201).json({
    success: true,
    data: {
      id: saved.id,
      rating: saved.rating,
      feedback: saved.feedback,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      panelist: serializeUser(saved.panelist),
    },
  });
});
