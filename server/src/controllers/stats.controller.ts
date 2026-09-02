import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  candidateScopeWhere,
  requisitionScopeWhere,
} from '../services/authorization.service.js';

/**
 * GET /api/stats/dashboard
 *
 * Counts are computed over the same scoped `where` clauses used by the list
 * endpoints, so a dashboard tile can never reveal the size of data the user is
 * not allowed to read.
 */
export const dashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const candidateWhere = candidateScopeWhere(user);

  const [candidateCount, requisitionCount, byStatus, pendingFeedback] = await Promise.all([
    prisma.candidate.count({ where: candidateWhere }),
    user.role === 'PANELIST'
      ? Promise.resolve(0)
      : prisma.jobRequisition.count({ where: requisitionScopeWhere(user) }),
    prisma.candidate.groupBy({
      by: ['status'],
      where: candidateWhere,
      _count: { _all: true },
    }),
    user.role === 'PANELIST'
      ? prisma.candidate.count({
          where: {
            AND: [candidateWhere, { feedback: { none: { panelistId: user.id } } }],
          },
        })
      : Promise.resolve(0),
  ]);

  const openRequisitions =
    user.role === 'PANELIST'
      ? 0
      : await prisma.jobRequisition.count({
          where: { AND: [requisitionScopeWhere(user), { status: 'OPEN' }] },
        });

  res.json({
    success: true,
    data: {
      role: user.role,
      candidateCount,
      requisitionCount,
      openRequisitions,
      pendingFeedback,
      candidatesByStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
    },
  });
});
