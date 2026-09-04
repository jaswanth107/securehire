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

const RELATIVE_UNITS: [limit: number, seconds: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [604800, 86400, 'day'],
  [2629800, 604800, 'week'],
  [31557600, 2629800, 'month'],
];

/** "3 minutes ago" — used by the activity feed, where exact times add noise. */
export function relativeTime(value: string): string {
  const elapsed = (Date.now() - new Date(value).getTime()) / 1000;
  if (elapsed < 45) return 'just now';

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [limit, seconds, unit] of RELATIVE_UNITS) {
    if (elapsed < limit) return formatter.format(-Math.round(elapsed / seconds), unit);
  }
  return formatter.format(-Math.round(elapsed / 31557600), 'year');
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
