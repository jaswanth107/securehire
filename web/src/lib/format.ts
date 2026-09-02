import type { CandidateStatus, RequisitionStatus, Role } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  PANELIST: 'Panelist',
};

export const CANDIDATE_STATUSES: CandidateStatus[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEWING',
  'OFFER',
  'HIRED',
  'REJECTED',
];

export const REQUISITION_STATUSES: RequisitionStatus[] = ['OPEN', 'ON_HOLD', 'CLOSED'];

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
