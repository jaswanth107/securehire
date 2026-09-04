import type { ActivityAction, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/errors.js';
import type { RequestUser } from '../types/express.js';

/**
 * ---------------------------------------------------------------------------
 * Central authorization service.
 * ---------------------------------------------------------------------------
 * Every access decision in the API is made here, from the *effective* user
 * resolved by the authentication middleware. Controllers never compare IDs
 * themselves and never read an owner ID from the request body or query string.
 *
 * Denial strategy: a non-admin who is not allowed to see a resource always gets
 * the same 403 with the same message, whether the resource is missing or simply
 * belongs to someone else. That keeps IDs non-enumerable. Admins — who may see
 * everything anyway — get an honest 404 for a missing row.
 */

export type CandidateAction = 'read' | 'create' | 'update' | 'delete' | 'assign' | 'feedback';
export type RequisitionAction = 'read' | 'create' | 'update' | 'delete';

export const isAdmin = (user: RequestUser): boolean => user.role === 'ADMIN';

/** Throws unless the effective user holds one of the given roles. */
export function requireRoleOrThrow(user: RequestUser, roles: Role[]): void {
  if (!roles.includes(user.role)) throw forbidden();
}

export function requireAdminOrThrow(user: RequestUser): void {
  if (!isAdmin(user)) throw forbidden();
}

/* -------------------------------------------------------------------------- */
/* Scoped list filters — applied inside the database query, never after it.    */
/* -------------------------------------------------------------------------- */

/**
 * The `where` clause that reduces the candidate table to exactly what this user
 * may see. Removing this filter is what the leak tests are designed to catch.
 */
export function candidateScopeWhere(user: RequestUser): Prisma.CandidateWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'RECRUITER':
      return { requisition: { recruiterId: user.id } };
    case 'PANELIST':
      return { assignments: { some: { panelistId: user.id } } };
    default:
      // Unknown role: deny by construction rather than fall through to `{}`.
      return { id: '__no_access__' };
  }
}

export function requisitionScopeWhere(user: RequestUser): Prisma.JobRequisitionWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'RECRUITER':
      return { recruiterId: user.id };
    default:
      return { id: '__no_access__' };
  }
}

/* -------------------------------------------------------------------------- */
/* Resource-level checks.                                                      */
/* -------------------------------------------------------------------------- */

export type AuthorizedCandidate = Prisma.CandidateGetPayload<{
  include: { requisition: { select: { id: true; title: true; department: true; recruiterId: true } } };
}>;

/**
 * Loads a candidate only if the effective user is allowed to perform `action`
 * on it. This is the single gate used by every candidate-scoped route, so a new
 * route cannot accidentally skip the ownership/assignment check.
 */
export async function authorizeCandidateAccess(
  user: RequestUser,
  candidateId: string,
  action: CandidateAction,
): Promise<AuthorizedCandidate> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      requisition: { select: { id: true, title: true, department: true, recruiterId: true } },
    },
  });

  if (!candidate) {
    if (isAdmin(user)) throw notFound('Candidate not found.');
    throw forbidden();
  }

  switch (user.role) {
    case 'ADMIN':
      return candidate;

    case 'RECRUITER': {
      // Ownership is derived from the authenticated identity, never from input.
      if (candidate.requisition.recruiterId !== user.id) throw forbidden();
      // Recruiters own the hiring pipeline but do not submit panel feedback.
      if (action === 'feedback') throw forbidden();
      return candidate;
    }

    case 'PANELIST': {
      if (action !== 'read' && action !== 'feedback') throw forbidden();
      const assigned = await verifyPanelistAssignment(user.id, candidateId);
      if (!assigned) throw forbidden();
      return candidate;
    }

    default:
      throw forbidden();
  }
}

/** The explicit assignment record is the only source of panelist visibility. */
export async function verifyPanelistAssignment(
  panelistId: string,
  candidateId: string,
): Promise<boolean> {
  const assignment = await prisma.candidatePanelistAssignment.findUnique({
    where: { candidateId_panelistId: { candidateId, panelistId } },
    select: { id: true },
  });
  return assignment !== null;
}

export type AuthorizedRequisition = Prisma.JobRequisitionGetPayload<{
  include: { recruiter: { select: { id: true; name: true; email: true } } };
}>;

export async function authorizeRequisitionAccess(
  user: RequestUser,
  requisitionId: string,
  action: RequisitionAction,
): Promise<AuthorizedRequisition> {
  // Panelists have no requisition surface at all; assigned-candidate context is
  // delivered inside the candidate payload instead.
  if (user.role === 'PANELIST') throw forbidden();

  const requisition = await prisma.jobRequisition.findUnique({
    where: { id: requisitionId },
    include: { recruiter: { select: { id: true, name: true, email: true } } },
  });

  if (!requisition) {
    if (isAdmin(user)) throw notFound('Requisition not found.');
    throw forbidden();
  }

  if (isAdmin(user)) return requisition;

  if (user.role === 'RECRUITER') {
    const owns = await verifyRecruiterOwnership(user.id, requisitionId);
    if (!owns) throw forbidden();
    // Recruiters manage their own requisitions but cannot delete them; closing
    // a requisition is a status change, and deletion cascades to candidates.
    if (action === 'delete') throw forbidden();
    return requisition;
  }

  throw forbidden();
}

export async function verifyRecruiterOwnership(
  recruiterId: string,
  requisitionId: string,
): Promise<boolean> {
  const match = await prisma.jobRequisition.findFirst({
    where: { id: requisitionId, recruiterId },
    select: { id: true },
  });
  return match !== null;
}

/**
 * Guards writes that name a requisition (creating or moving a candidate).
 * A recruiter may only target a requisition they own, so a forged
 * `requisitionId` in the body cannot move a candidate into — or out of —
 * another recruiter's tenancy.
 */
export async function authorizeRequisitionTarget(
  user: RequestUser,
  requisitionId: string,
): Promise<void> {
  if (isAdmin(user)) {
    const exists = await prisma.jobRequisition.findUnique({
      where: { id: requisitionId },
      select: { id: true },
    });
    if (!exists) throw notFound('Requisition not found.');
    return;
  }

  if (user.role !== 'RECRUITER') throw forbidden();
  const owns = await verifyRecruiterOwnership(user.id, requisitionId);
  if (!owns) throw forbidden();
}

/* -------------------------------------------------------------------------- */
/* Activity feed scope.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The actions a panelist may ever see in the feed.
 *
 * The feed is a read surface over *every* mutation in the system, so it is the
 * one place where a missing filter leaks the whole application at once. This
 * allow-list is deliberately positive: a new ActivityAction is invisible to
 * panelists until somebody adds it here on purpose.
 */
export const PANELIST_VISIBLE_ACTIONS: ActivityAction[] = [
  'PANELIST_ASSIGNED',
  'PANELIST_UNASSIGNED',
  'FEEDBACK_SUBMITTED',
  'CANDIDATE_STATUS_CHANGED',
];

/**
 * The `where` clause that reduces the activity log to what this user may read.
 *
 * Unlike the other scope helpers this one is async: a panelist's visibility is
 * defined by the assignment table, and the event rows hold no relation to join
 * through (by design — see the schema).
 *
 *   ADMIN     — everything.
 *   RECRUITER — events tagged with their own tenancy.
 *   PANELIST  — only events on candidates they are *currently* assigned to,
 *               narrowed again to their own actions and things done to them.
 *               A panelist must not learn who else sits on a panel, or that
 *               another panelist has filed feedback, since neither the
 *               candidate payload nor the feedback endpoint tells them.
 */
export async function activityScopeWhere(
  user: RequestUser,
): Promise<Prisma.ActivityEventWhereInput> {
  switch (user.role) {
    case 'ADMIN':
      return {};

    case 'RECRUITER':
      return { recruiterId: user.id };

    case 'PANELIST': {
      const assignments = await prisma.candidatePanelistAssignment.findMany({
        where: { panelistId: user.id },
        select: { candidateId: true },
      });
      const candidateIds = assignments.map((a) => a.candidateId);
      if (candidateIds.length === 0) return { id: '__no_access__' };

      return {
        AND: [
          { candidateId: { in: candidateIds } },
          { action: { in: PANELIST_VISIBLE_ACTIONS } },
          {
            OR: [
              // Pipeline movement on a candidate they are interviewing. The
              // presenter strips the actor from these — panelists have no user
              // directory, so naming the recruiter would be a new disclosure.
              { action: 'CANDIDATE_STATUS_CHANGED' },
              // Their own actions, and actions taken on them.
              { actorId: user.id },
              { targetUserId: user.id },
            ],
          },
        ],
      };
    }

    default:
      return { id: '__no_access__' };
  }
}
