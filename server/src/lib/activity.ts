import type { ActivityAction, Prisma, PrismaClient } from '@prisma/client';
import type { Request } from 'express';

/**
 * ---------------------------------------------------------------------------
 * Audit event recording.
 * ---------------------------------------------------------------------------
 * Every mutation in the API writes one row through here, inside the same
 * transaction as the change itself, so the log can never disagree with the
 * data: if the write rolls back, so does its audit entry.
 *
 * The single rule this file exists to enforce is in `actorFrom`. The actor is
 * the *authenticated* identity, never `req.user` — an admin acting while
 * previewing as a recruiter is recorded as the admin, with the previewed
 * identity kept alongside it. An audit log that attributed that action to the
 * recruiter would be worse than no audit log at all.
 */

/** Accepts either the client or a transaction handle from `$transaction`. */
export type ActivityClient = PrismaClient | Prisma.TransactionClient;

export interface ActivityInput {
  action: ActivityAction;
  /** Owner of the affected requisition — the tenancy key for recruiter scoping. */
  recruiterId?: string | null;
  requisitionId?: string | null;
  requisitionTitle?: string | null;
  candidateId?: string | null;
  candidateName?: string | null;
  targetUserId?: string | null;
  targetUserName?: string | null;
  detail?: Prisma.InputJsonValue;
}

interface Actor {
  actorId: string;
  actorName: string;
  onBehalfOfId: string | null;
  onBehalfOfName: string | null;
}

export function actorFrom(req: Request): Actor {
  // `authenticatedUser` is set by `authenticateUser` from the verified token and
  // is not influenced by any header, body or query value.
  const authenticated = req.authenticatedUser!;
  const effective = req.user!;
  const previewing = authenticated.id !== effective.id;

  return {
    actorId: authenticated.id,
    actorName: authenticated.name,
    onBehalfOfId: previewing ? effective.id : null,
    onBehalfOfName: previewing ? effective.name : null,
  };
}

export async function recordEvent(
  client: ActivityClient,
  req: Request,
  input: ActivityInput,
): Promise<void> {
  await client.activityEvent.create({
    data: {
      ...actorFrom(req),
      action: input.action,
      recruiterId: input.recruiterId ?? null,
      requisitionId: input.requisitionId ?? null,
      requisitionTitle: input.requisitionTitle ?? null,
      candidateId: input.candidateId ?? null,
      candidateName: input.candidateName ?? null,
      targetUserId: input.targetUserId ?? null,
      targetUserName: input.targetUserName ?? null,
      ...(input.detail === undefined ? {} : { detail: input.detail }),
    },
  });
}

/** Records several events for one request (an update that changed two things). */
export async function recordEvents(
  client: ActivityClient,
  req: Request,
  inputs: ActivityInput[],
): Promise<void> {
  for (const input of inputs) await recordEvent(client, req, input);
}
