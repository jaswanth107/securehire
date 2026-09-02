import type { Candidate, JobRequisition, User } from '@prisma/client';
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
