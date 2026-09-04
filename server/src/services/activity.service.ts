import type { ActivityEvent } from '@prisma/client';
import { serializeActivityEvent, type SerializedActivityEvent } from '../lib/presenters.js';
import type { RequestUser } from '../types/express.js';

/**
 * ---------------------------------------------------------------------------
 * Read-side grouping.
 * ---------------------------------------------------------------------------
 * A recruiter adding twenty candidates sends twenty separate POSTs, so the log
 * holds twenty rows. Left flat they would bury everything else in the feed, so
 * adjacent rows from the same actor doing the same thing in the same
 * requisition are collapsed into one entry the UI can expand.
 *
 * This is done on read rather than at write time on purpose: it needs no
 * batch id, so it works no matter how the client submits the work — including
 * a script hitting the API directly.
 */

/** Longest gap between two events that still counts as the same burst. */
const MAX_GAP_MS = 5 * 60 * 1000;
/** Ceiling on a whole group, so a slow drip never merges into one giant row. */
const MAX_SPAN_MS = 60 * 60 * 1000;

export interface ActivityGroup {
  /** The id of the newest event in the group — stable enough for a React key. */
  id: string;
  action: ActivityEvent['action'];
  count: number;
  firstAt: Date;
  lastAt: Date;
  events: SerializedActivityEvent[];
}

/** Two events belong together only if the actor, action and tenancy all match. */
function sameBurst(a: ActivityEvent, b: ActivityEvent): boolean {
  return (
    a.actorId === b.actorId &&
    a.action === b.action &&
    a.requisitionId === b.requisitionId &&
    a.onBehalfOfId === b.onBehalfOfId
  );
}

/**
 * Groups one already-scoped, already-ordered (newest first) page of events.
 *
 * A burst that straddles a page boundary is shown as two groups rather than
 * one. That is a cosmetic edge, and the alternative — reading past the page to
 * find where the burst ends — would make the page size unbounded.
 */
export function groupEvents(events: ActivityEvent[], viewer: RequestUser): ActivityGroup[] {
  const groups: ActivityGroup[] = [];

  events.forEach((event, index) => {
    const current = groups[groups.length - 1];
    // Events arrive newest first, so the previous element is the newer
    // neighbour and `firstAt` walks backwards in time as a group grows.
    const previous = index > 0 ? events[index - 1]! : null;

    if (
      current &&
      previous &&
      sameBurst(previous, event) &&
      previous.createdAt.getTime() - event.createdAt.getTime() <= MAX_GAP_MS &&
      current.lastAt.getTime() - event.createdAt.getTime() <= MAX_SPAN_MS
    ) {
      current.count += 1;
      current.firstAt = event.createdAt;
      current.events.push(serializeActivityEvent(event, viewer));
      return;
    }

    groups.push({
      id: event.id,
      action: event.action,
      count: 1,
      firstAt: event.createdAt,
      lastAt: event.createdAt,
      events: [serializeActivityEvent(event, viewer)],
    });
  });

  return groups;
}
