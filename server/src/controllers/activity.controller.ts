import type { ActivityAction, Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest } from '../lib/errors.js';
import { activityScopeWhere } from '../services/authorization.service.js';
import { groupEvents } from '../services/activity.service.js';

const DEFAULT_LIMIT = 40;

/**
 * GET /api/activity
 *
 * The scope `where` is ANDed into the query, exactly like the candidate and
 * requisition lists: query-string filters can narrow what comes back, never
 * widen it. Every row is then put through the viewer-aware presenter, because
 * the scope decides *which* events you see and the presenter decides how much
 * of each one you are told.
 */
export const listActivity = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { limit, cursor, action, actorId, candidateId, requisitionId } = req.query as {
    limit?: number;
    cursor?: string;
    action?: ActivityAction;
    actorId?: string;
    candidateId?: string;
    requisitionId?: string;
  };

  const scope = await activityScopeWhere(user);

  const filters: Prisma.ActivityEventWhereInput = {};
  if (action) filters.action = action;
  if (actorId) filters.actorId = actorId;
  if (candidateId) filters.candidateId = candidateId;
  if (requisitionId) filters.requisitionId = requisitionId;

  const where: Prisma.ActivityEventWhereInput = { AND: [scope, filters] };

  // The cursor is resolved *inside* the caller's scope, so a guessed id cannot
  // be used to test whether an event exists: an out-of-scope cursor and a
  // nonexistent one fail identically.
  if (cursor) {
    const anchor = await prisma.activityEvent.findFirst({
      where: { AND: [scope, { id: cursor }] },
      select: { id: true },
    });
    if (!anchor) throw badRequest('Invalid cursor.');
  }

  const take = limit ?? DEFAULT_LIMIT;
  const rows = await prisma.activityEvent.findMany({
    where,
    // `id` breaks ties so the cursor never skips or repeats an event that
    // shares a timestamp with its neighbour — likely during a bulk add.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  res.json({
    success: true,
    data: {
      groups: groupEvents(page, user),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    },
  });
});

/**
 * GET /api/activity/unread
 *
 * Counted over the same scope as the feed, so the badge can never hint at the
 * volume of activity a user is not allowed to read. Your own actions are
 * excluded — you do not need notifying about what you just did.
 */
export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const scope = await activityScopeWhere(user);
  const state = await prisma.notificationState.findUnique({ where: { userId: user.id } });

  const count = await prisma.activityEvent.count({
    where: {
      AND: [
        scope,
        { actorId: { not: user.id } },
        // No marker yet means nothing has ever been read, so everything counts.
        ...(state ? [{ createdAt: { gt: state.lastReadAt } }] : []),
      ],
    },
  });

  res.json({ success: true, data: { count, lastReadAt: state?.lastReadAt ?? null } });
});

/**
 * POST /api/activity/read — moves this user's read marker to now.
 *
 * Deliberately inert during preview. An admin looking through a recruiter's
 * eyes should not clear that recruiter's unread badge as a side effect of
 * looking: preview is for observing the app, not for editing someone's state.
 */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (req.isPreview) {
    const state = await prisma.notificationState.findUnique({ where: { userId: user.id } });
    res.json({
      success: true,
      data: { lastReadAt: state?.lastReadAt ?? null, appliedInPreview: false },
    });
    return;
  }

  const now = new Date();
  const state = await prisma.notificationState.upsert({
    where: { userId: user.id },
    create: { userId: user.id, lastReadAt: now },
    update: { lastReadAt: now },
  });

  res.json({ success: true, data: { lastReadAt: state.lastReadAt, appliedInPreview: false } });
});
