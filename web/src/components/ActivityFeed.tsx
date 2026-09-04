import { useState } from 'react';
import { Link } from 'react-router-dom';
import { describeGroup, type ActivityIcon } from '../lib/activity';
import { formatDateTime, relativeTime } from '../lib/format';
import type { ActivityGroup } from '../lib/types';

const ICON_PATHS: Record<ActivityIcon, string> = {
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z',
  arrow: 'M4 12h13M13 7l5 5-5 5',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  panel: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1.5a4 4 0 0 0-3-3.87',
  star: 'm12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8z',
  folder: 'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M9 4h6a1 1 0 0 1 1 1v2H8V5a1 1 0 0 1 1-1',
  user: 'M17 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
};

const TONE_STYLE = {
  neutral: 'bg-subtle text-muted',
  brand: 'bg-brand-soft text-brand-ink',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
} as const;

/**
 * One entry in the feed. A group of more than one collapses to a summary line
 * with an expander, so a recruiter adding twenty candidates is one row a
 * reviewer can open, not twenty rows they have to scroll past.
 */
export function ActivityRow({
  group,
  viewerId,
  unread,
  compact = false,
}: {
  group: ActivityGroup;
  viewerId: string;
  unread: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const description = describeGroup(group, viewerId);
  const spansTime = group.firstAt !== group.lastAt;

  return (
    <li className={`flex gap-3 px-4 ${compact ? 'py-2.5' : 'py-3.5'} ${unread ? 'bg-brand-soft/35' : ''}`}>
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${TONE_STYLE[description.tone]}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON_PATHS[description.icon]} />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-muted">
          {description.lead ? (
            <span className="font-semibold text-ink">{description.lead} </span>
          ) : null}
          {description.text}
        </p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
          <time dateTime={group.lastAt} title={formatDateTime(group.lastAt)}>
            {relativeTime(group.lastAt)}
          </time>
          {group.count > 1 ? (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="font-medium text-brand-ink hover:underline"
                aria-expanded={expanded}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? 'Hide' : `Show all ${group.count}`}
              </button>
              {spansTime ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>over {relativeTime(group.firstAt).replace(' ago', '')}</span>
                </>
              ) : null}
            </>
          ) : null}
        </p>

        {expanded ? (
          <ul className="mt-2 space-y-1 border-l border-border pl-3">
            {group.events.map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                {event.candidateId ? (
                  <Link to={`/candidates/${event.candidateId}`} className="truncate text-ink hover:underline">
                    {event.candidateName ?? 'Candidate'}
                  </Link>
                ) : (
                  <span className="truncate text-ink">
                    {event.candidateName ?? event.requisitionTitle ?? 'Record'}
                  </span>
                )}
                <time className="shrink-0 text-faint" dateTime={event.createdAt}>
                  {relativeTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * `unreadSince` is the read marker captured when the panel was opened, so newly
 * arrived entries stay highlighted while the reader looks at them rather than
 * clearing the instant the badge is marked read.
 */
export function ActivityList({
  groups,
  viewerId,
  unreadSince,
  compact = false,
}: {
  groups: ActivityGroup[];
  viewerId: string;
  unreadSince: string | null;
  compact?: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {groups.map((group) => (
        <ActivityRow
          key={group.id}
          group={group}
          viewerId={viewerId}
          compact={compact}
          unread={
            unreadSince !== null &&
            group.events[0]?.actor?.id !== viewerId &&
            new Date(group.lastAt) > new Date(unreadSince)
          }
        />
      ))}
    </ul>
  );
}
