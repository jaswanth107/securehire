import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { ActivityList } from './ActivityFeed';
import { EmptyState, Skeleton } from './ui';
import type { ActivityPage, UnreadState } from '../lib/types';

const POLL_INTERVAL_MS = 30_000;
const PANEL_SIZE = 12;

/**
 * The header bell.
 *
 * Polling on an interval rather than a socket: the feed is a review surface,
 * not a chat, and half a minute of latency costs nothing next to a persistent
 * connection per open tab.
 */
export function NotificationBell() {
  const { session, isPreview } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Frozen when the panel opens, so entries stay marked "new" while they are
  // being read instead of un-highlighting the moment the badge is cleared.
  const [unreadSince, setUnreadSince] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const viewerId = session?.effectiveUser.id ?? '';

  const unreadQuery = useQuery({
    queryKey: ['activity', 'unread', viewerId],
    queryFn: () => api<UnreadState>('/activity/unread'),
    refetchInterval: POLL_INTERVAL_MS,
    enabled: Boolean(viewerId),
  });

  const feedQuery = useQuery({
    queryKey: ['activity', 'panel', viewerId],
    queryFn: () => api<ActivityPage>(`/activity?limit=${PANEL_SIZE}`),
    enabled: open && Boolean(viewerId),
  });

  const markRead = useMutation({
    mutationFn: () => api<UnreadState>('/activity/read', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity', 'unread', viewerId] }),
  });

  // Opening the panel is the read receipt. The server ignores this during
  // preview, so an admin looking through someone else's eyes cannot silently
  // clear that person's badge.
  useEffect(() => {
    if (!open) return;
    setUnreadSince(unreadQuery.data?.lastReadAt ?? null);
    markRead.mutate();
    // Deliberately keyed on `open` alone: this fires once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // While the panel is open it owns outside clicks and Escape, matching the
  // navigation drawer's behaviour.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (!session) return null;

  const count = unreadQuery.data?.count ?? 0;
  const groups = feedQuery.data?.groups ?? [];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-subtle hover:text-ink"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-[18px] text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Recent activity"
          className="card absolute right-0 z-40 mt-2 flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden shadow-pop"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Recent activity</h2>
            {isPreview ? (
              <span className="text-[11px] text-faint">Preview — badge not cleared</span>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {feedQuery.isPending ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-2/3" />
              </div>
            ) : groups.length === 0 ? (
              <EmptyState title="Nothing yet" description="Actions taken across your work will show up here." />
            ) : (
              <ActivityList groups={groups} viewerId={viewerId} unreadSince={unreadSince} compact />
            )}
          </div>

          <footer className="border-t border-border px-4 py-2.5">
            <Link
              to="/activity"
              className="text-[12px] font-medium text-brand-ink hover:underline"
              onClick={() => setOpen(false)}
            >
              View all activity →
            </Link>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
