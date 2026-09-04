import type { ActivityEvent, Candidate, JobRequisition, User } from '@prisma/client';
import type { RequestUser } from '../types/express.js';

/** Password hashes never leave the service layer. */
export function serializeUser(user: Pick<User, 'id' | 'name' | 'email' | 'role'> & Partial<User>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.isActive === undefined ? {} : { isActive: user.isActive }),
    ...(user.createdAt === undefined ? {} : { createdAt: user.createdAt }),
  };
}

type CandidateWithRequisition = Candidate & {
  requisition: Pick<JobRequisition, 'id' | 'title' | 'department'> & { recruiterId?: string };
};

/**
 * Candidate payload shaped to the viewer.
 *
 * Panelists are interviewers, not pipeline owners: they receive the details
 * needed to run and score an interview and nothing more. Contact details,
 * recruiter notes and requisition ownership stay out of their payload even for
 * candidates they are legitimately assigned to.
 */
export function serializeCandidate(candidate: CandidateWithRequisition, viewer: RequestUser) {
  const base = {
    id: candidate.id,
    name: candidate.name,
    status: candidate.status,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    requisition: {
      title: candidate.requisition.title,
      department: candidate.requisition.department,
    },
  };

  if (viewer.role === 'PANELIST') return base;

  return {
    ...base,
    email: candidate.email,
    phone: candidate.phone,
    notes: candidate.notes,
    requisitionId: candidate.requisitionId,
    requisition: {
      id: candidate.requisition.id,
      title: candidate.requisition.title,
      department: candidate.requisition.department,
    },
  };
}

/**
 * Activity event payload shaped to the viewer.
 *
 * The feed is the one endpoint that reads across the whole system, so it gets
 * the same treatment as `serializeCandidate`: a panelist receives the fact that
 * something happened to a candidate they are interviewing, and nothing about
 * who runs the pipeline. They have no user directory anywhere in the app, so
 * naming the recruiter here would be a disclosure no other endpoint makes.
 *
 * Recruiters *do* see the actor, including an admin who acted inside their
 * tenancy while previewing as them. Hiding that would defeat the point of
 * keeping the log.
 */
export function serializeActivityEvent(event: ActivityEvent, viewer: RequestUser) {
  const base = {
    id: event.id,
    action: event.action,
    createdAt: event.createdAt,
    candidateId: event.candidateId,
    candidateName: event.candidateName,
    requisitionTitle: event.requisitionTitle,
    detail: event.detail,
  };

  if (viewer.role === 'PANELIST') {
    const isOwnAction = event.actorId === viewer.id;
    return {
      ...base,
      // Their own entries stay attributed; everything else is deliberately
      // anonymous ("Candidate moved to Offer").
      actor: isOwnAction ? { id: event.actorId, name: event.actorName } : null,
      targetUser:
        event.targetUserId === viewer.id
          ? { id: event.targetUserId, name: event.targetUserName }
          : null,
    };
  }

  return {
    ...base,
    actor: { id: event.actorId, name: event.actorName },
    onBehalfOf: event.onBehalfOfId
      ? { id: event.onBehalfOfId, name: event.onBehalfOfName }
      : null,
    requisitionId: event.requisitionId,
    recruiterId: event.recruiterId,
    targetUser: event.targetUserId
      ? { id: event.targetUserId, name: event.targetUserName }
      : null,
  };
}

export type SerializedActivityEvent = ReturnType<typeof serializeActivityEvent>;
