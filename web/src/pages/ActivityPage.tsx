import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityList } from '../components/ActivityFeed';
import { Button, Card, EmptyState, ErrorNotice, PageHeader, Select, Skeleton } from '../components/ui';
import { useSession } from '../context/SessionContext';
import { api, ApiError } from '../lib/api';
import { ACTION_FILTERS } from '../lib/activity';
import type { ActivityAction, ActivityPage as ActivityPageData } from '../lib/types';

const PAGE_SIZE = 40;

const DESCRIPTION: Record<string, string> = {
  ADMIN: 'Every action taken across the system, newest first.',
  RECRUITER: 'Everything that happened inside your requisitions.',
  PANELIST: 'Interviews you were assigned and feedback you filed.',
};

export function ActivityPage() {
  const { session } = useSession();
  const [action, setAction] = useState<ActivityAction | ''>('');

  const viewerId = session?.effectiveUser.id ?? '';
  const role = session?.effectiveUser.role ?? 'PANELIST';

  const query = useInfiniteQuery({
    queryKey: ['activity', 'page', viewerId, action],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (action) params.set('action', action);
      if (pageParam) params.set('cursor', pageParam);
      return api<ActivityPageData>(`/activity?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(viewerId),
  });

  const groups = query.data?.pages.flatMap((page) => page.groups) ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        description={DESCRIPTION[role]}
        action={
          <Select
            aria-label="Filter activity"
            className="w-56"
            value={action}
            onChange={(event) => setAction(event.target.value as ActivityAction | '')}
          >
            {ACTION_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </Select>
        }
      />

      {query.isError ? (
        <ErrorNotice
          message={
            query.error instanceof ApiError ? query.error.message : 'Could not load the activity log.'
          }
        />
      ) : null}

      <Card>
        {query.isPending ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Once candidates are added, moved or reviewed, the trail shows up here."
          />
        ) : (
          <>
            {/* The read marker belongs to the bell; this page is the archive, so
                nothing is highlighted as new here. */}
            <ActivityList groups={groups} viewerId={viewerId} unreadSince={null} />
            {query.hasNextPage ? (
              <div className="flex justify-center border-t border-border px-5 py-4">
                <Button
                  variant="secondary"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? 'Loading…' : 'Load older activity'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
