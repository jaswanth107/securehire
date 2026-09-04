import { titleCase } from './format';
import type { ActivityAction, ActivityEvent, ActivityGroup } from './types';

/**
 * Turns a grouped activity entry into a sentence.
 *
 * The API withholds the actor from a panelist on anything they did not do
 * themselves, so every line has to read correctly with `actor` missing. Rather
 * than printing "Someone", those cases are phrased passively — "Ananya Rao
 * moved to Offer" — which is the honest rendering of what the viewer is
 * allowed to know.
 */

export interface ActivityDescription {
  /** Emphasised lead-in, usually a person. Null when the sentence stands alone. */
  lead: string | null;
  text: string;
  tone: 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
  icon: ActivityIcon;
}

export type ActivityIcon = 'plus' | 'pencil' | 'arrow' | 'trash' | 'panel' | 'star' | 'folder' | 'user';

const ICON_BY_ACTION: Record<ActivityAction, ActivityIcon> = {
  CANDIDATE_CREATED: 'plus',
  CANDIDATE_UPDATED: 'pencil',
  CANDIDATE_STATUS_CHANGED: 'arrow',
  CANDIDATE_DELETED: 'trash',
  PANELIST_ASSIGNED: 'panel',
  PANELIST_UNASSIGNED: 'panel',
  FEEDBACK_SUBMITTED: 'star',
  REQUISITION_CREATED: 'folder',
  REQUISITION_UPDATED: 'folder',
  REQUISITION_STATUS_CHANGED: 'folder',
  REQUISITION_DELETED: 'trash',
  USER_ACTIVATED: 'user',
  USER_DEACTIVATED: 'user',
};

const TONE_BY_ACTION: Record<ActivityAction, ActivityDescription['tone']> = {
  CANDIDATE_CREATED: 'brand',
  CANDIDATE_UPDATED: 'neutral',
  CANDIDATE_STATUS_CHANGED: 'success',
  CANDIDATE_DELETED: 'danger',
  PANELIST_ASSIGNED: 'brand',
  PANELIST_UNASSIGNED: 'warn',
  FEEDBACK_SUBMITTED: 'success',
  REQUISITION_CREATED: 'brand',
  REQUISITION_UPDATED: 'neutral',
  REQUISITION_STATUS_CHANGED: 'warn',
  REQUISITION_DELETED: 'danger',
  USER_ACTIVATED: 'success',
  USER_DEACTIVATED: 'danger',
};

const detailString = (event: ActivityEvent, key: string): string | null => {
  const value = event.detail?.[key];
  return typeof value === 'string' ? value : null;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "Recruiter Alice", "You", or "Admin John (as Recruiter Alice)". */
function actorLabel(event: ActivityEvent, viewerId: string): string | null {
  if (!event.actor) return null;
  const name = event.actor.id === viewerId ? 'You' : event.actor.name;
  // Preview is surfaced, not hidden: this is the whole reason the log records
  // both identities.
  return event.onBehalfOf ? `${name} (as ${event.onBehalfOf.name})` : name;
}

function personLabel(person: { id: string; name: string } | null, viewerId: string): string {
  if (!person) return 'someone';
  return person.id === viewerId ? 'you' : person.name;
}

export function describeGroup(group: ActivityGroup, viewerId: string): ActivityDescription {
  const event = group.events[0]!;
  const { count } = group;
  const lead = actorLabel(event, viewerId);
  const candidate = event.candidateName ?? 'a candidate';
  const requisition = event.requisitionTitle;
  const into = requisition ? ` in ${requisition}` : '';

  const base = { tone: TONE_BY_ACTION[group.action], icon: ICON_BY_ACTION[group.action] };

  switch (group.action) {
    case 'CANDIDATE_CREATED':
      return {
        ...base,
        lead,
        text:
          count === 1
            ? `added ${candidate}${requisition ? ` to ${requisition}` : ''}`
            : `added ${plural(count, 'candidate')}${requisition ? ` to ${requisition}` : ''}`,
      };

    case 'CANDIDATE_UPDATED': {
      const fields = event.detail?.fields;
      const suffix = Array.isArray(fields) && count === 1 ? ` — ${fields.join(', ')}` : '';
      return {
        ...base,
        lead,
        text: count === 1 ? `updated ${candidate}${suffix}` : `updated ${plural(count, 'candidate')}${into}`,
      };
    }

    case 'CANDIDATE_STATUS_CHANGED': {
      const from = detailString(event, 'from');
      const to = detailString(event, 'to');
      if (count > 1) {
        return { ...base, lead, text: `changed the status of ${plural(count, 'candidate')}${into}` };
      }
      const move = from && to ? `from ${titleCase(from)} to ${titleCase(to)}` : 'to a new stage';
      // No actor: the viewer is a panelist, who is told the candidate moved but
      // not who moved them.
      return lead
        ? { ...base, lead, text: `moved ${candidate} ${move}` }
        : { ...base, lead: null, text: `${candidate} moved ${move}` };
    }

    case 'CANDIDATE_DELETED':
      return {
        ...base,
        lead,
        text:
          count === 1
            ? `deleted ${candidate}${requisition ? ` from ${requisition}` : ''}`
            : `deleted ${plural(count, 'candidate')}${requisition ? ` from ${requisition}` : ''}`,
      };

    case 'PANELIST_ASSIGNED': {
      if (!lead && event.targetUser?.id === viewerId) {
        return { ...base, lead: null, text: `You were assigned to interview ${candidate}` };
      }
      return {
        ...base,
        lead,
        text:
          count === 1
            ? `assigned ${personLabel(event.targetUser, viewerId)} to interview ${candidate}`
            : `made ${plural(count, 'panel assignment')}${into}`,
      };
    }

    case 'PANELIST_UNASSIGNED': {
      if (!lead && event.targetUser?.id === viewerId) {
        return { ...base, lead: null, text: `You were removed from the panel for ${candidate}` };
      }
      return {
        ...base,
        lead,
        text:
          count === 1
            ? `removed ${personLabel(event.targetUser, viewerId)} from the panel for ${candidate}`
            : `removed ${plural(count, 'panellist')} from interview panels${into}`,
      };
    }

    case 'FEEDBACK_SUBMITTED': {
      const rating = typeof event.detail?.rating === 'number' ? event.detail.rating : null;
      const score = rating === null || count > 1 ? '' : ` — rated ${rating}/5`;
      // The submitter is the target; on a recruiter's feed the actor is the
      // same person, so `lead` already names them.
      const who = lead ?? personLabel(event.targetUser, viewerId);
      return {
        ...base,
        lead: lead ?? null,
        text:
          count === 1
            ? `${lead ? '' : `${who} `}submitted feedback for ${candidate}${score}`
            : `${lead ? '' : `${who} `}submitted ${plural(count, 'review')}${into}`,
      };
    }

    case 'REQUISITION_CREATED':
      return { ...base, lead, text: `opened ${requisition ?? 'a requisition'}` };

    case 'REQUISITION_UPDATED':
      return { ...base, lead, text: `updated ${requisition ?? 'a requisition'}` };

    case 'REQUISITION_STATUS_CHANGED': {
      const to = detailString(event, 'to');
      return {
        ...base,
        lead,
        text: `set ${requisition ?? 'a requisition'} to ${to ? titleCase(to) : 'a new status'}`,
      };
    }

    case 'REQUISITION_DELETED':
      return { ...base, lead, text: `deleted ${requisition ?? 'a requisition'}` };

    case 'USER_ACTIVATED':
      return { ...base, lead, text: `reactivated ${personLabel(event.targetUser, viewerId)}` };

    case 'USER_DEACTIVATED':
      return { ...base, lead, text: `deactivated ${personLabel(event.targetUser, viewerId)}` };

    default:
      return { ...base, lead, text: titleCase(group.action) };
  }
}

export const ACTION_FILTERS: { value: ActivityAction | ''; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'CANDIDATE_CREATED', label: 'Candidates added' },
  { value: 'CANDIDATE_STATUS_CHANGED', label: 'Status changes' },
  { value: 'CANDIDATE_UPDATED', label: 'Candidate edits' },
  { value: 'CANDIDATE_DELETED', label: 'Candidates deleted' },
  { value: 'PANELIST_ASSIGNED', label: 'Panel assignments' },
  { value: 'FEEDBACK_SUBMITTED', label: 'Feedback submitted' },
  { value: 'REQUISITION_CREATED', label: 'Requisitions opened' },
  { value: 'REQUISITION_STATUS_CHANGED', label: 'Requisition status' },
  { value: 'USER_DEACTIVATED', label: 'Accounts deactivated' },
];
