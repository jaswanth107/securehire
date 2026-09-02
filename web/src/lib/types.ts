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
