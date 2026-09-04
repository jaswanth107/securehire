export type Role = 'ADMIN' | 'RECRUITER' | 'PANELIST';

export type CandidateStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEWING'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED';

export type RequisitionStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Session {
  authenticatedUser: User;
  effectiveUser: User;
  isPreview: boolean;
}

export interface Requisition {
  id: string;
  title: string;
  department: string;
  description: string;
  status: RequisitionStatus;
  recruiterId: string;
  recruiter: User;
  candidateCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Contact fields are absent for panelists — the API omits them by design. */
export interface Candidate {
  id: string;
  name: string;
  status: CandidateStatus;
  createdAt: string;
  updatedAt: string;
  email?: string;
  phone?: string;
  notes?: string | null;
  requisitionId?: string;
  requisition: { id?: string; title: string; department: string };
}

export interface AssignedPanelist extends User {
  assignmentId: string;
  assignedAt: string;
}

export interface Feedback {
  id: string;
  rating: number;
  feedback: string;
  createdAt: string;
  updatedAt?: string;
  panelist: User;
}

export interface CandidateDetail extends Candidate {
  panelists?: AssignedPanelist[];
  feedback?: Feedback[];
  myFeedback?: Feedback | null;
}

export interface DashboardStats {
  role: Role;
  candidateCount: number;
  requisitionCount: number;
  openRequisitions: number;
  pendingFeedback: number;
  candidatesByStatus: { status: CandidateStatus; count: number }[];
}

export type ActivityAction =
  | 'CANDIDATE_CREATED'
  | 'CANDIDATE_UPDATED'
  | 'CANDIDATE_STATUS_CHANGED'
  | 'CANDIDATE_DELETED'
  | 'PANELIST_ASSIGNED'
  | 'PANELIST_UNASSIGNED'
  | 'FEEDBACK_SUBMITTED'
  | 'REQUISITION_CREATED'
  | 'REQUISITION_UPDATED'
  | 'REQUISITION_STATUS_CHANGED'
  | 'REQUISITION_DELETED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED';

export interface ActivityActor {
  id: string;
  name: string;
}

/**
 * Several fields are optional because the API shapes the payload to the viewer:
 * a panelist is not told who acted (unless it was them), and gets no requisition
 * ownership at all. Rendering must cope with their absence rather than assume it
 * cannot happen.
 */
export interface ActivityEvent {
  id: string;
  createdAt: string;
  candidateId: string | null;
  candidateName: string | null;
  requisitionTitle: string | null;
  actor: ActivityActor | null;
  targetUser: ActivityActor | null;
  detail: Record<string, unknown> | null;
  onBehalfOf?: ActivityActor | null;
  requisitionId?: string | null;
  recruiterId?: string | null;
}

/** Consecutive events from one actor doing one thing, collapsed by the API. */
export interface ActivityGroup {
  id: string;
  action: ActivityAction;
  count: number;
  firstAt: string;
  lastAt: string;
  events: ActivityEvent[];
}

export interface ActivityPage {
  groups: ActivityGroup[];
  nextCursor: string | null;
}

export interface UnreadState {
  count: number;
  lastReadAt: string | null;
}
