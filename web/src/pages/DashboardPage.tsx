import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Candidate, DashboardStats, Requisition } from '../lib/types';
import { useSession } from '../context/SessionContext';
import { CANDIDATE_STATUSES, formatDate } from '../lib/format';
import { Card, CardHeader, EmptyState, PageHeader, Skeleton, StatusPill } from '../components/ui';
import { PipelineBars } from '../components/PipelineBars';

function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function DashboardPage() {
  const { session } = useSession();
  const role = session?.effectiveUser.role;

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => api<DashboardStats>('/stats/dashboard'),
  });

  const candidates = useQuery({
    queryKey: ['candidates', 'recent'],
    queryFn: () => api<Candidate[]>('/candidates'),
  });

  const requisitions = useQuery({
    queryKey: ['requisitions'],
    enabled: role !== 'PANELIST',
    queryFn: () => api<Requisition[]>('/requisitions'),
  });

  const headline =
    role === 'ADMIN'
      ? 'Every requisition, candidate and panel assignment in the organisation.'
      : role === 'RECRUITER'
        ? 'Only the requisitions you own and the candidates inside them.'
        : 'Only the candidates you have been explicitly assigned to interview.';

  const byStatus = CANDIDATE_STATUSES.map((status) => ({
    status,
    count: stats.data?.candidatesByStatus.find((row) => row.status === status)?.count ?? 0,
  }));

  return (
    <>
      <PageHeader
        title={`Welcome back, ${session?.effectiveUser.name.split(' ')[0] ?? ''}`}
        description={headline}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading ? (
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[92px]" />)
        ) : (
          <>
            <StatTile
              label={role === 'PANELIST' ? 'Assigned to you' : 'Candidates in scope'}
              value={stats.data?.candidateCount ?? 0}
            />
            {role === 'PANELIST' ? (
              <StatTile
                label="Feedback outstanding"
                value={stats.data?.pendingFeedback ?? 0}
                hint="Interviews still waiting on your scorecard"
              />
            ) : (
              <StatTile label="Requisitions" value={stats.data?.requisitionCount ?? 0} />
            )}
            <StatTile
              label={role === 'PANELIST' ? 'Interviewing' : 'Open requisitions'}
              value={
                role === 'PANELIST'
                  ? byStatus.find((row) => row.status === 'INTERVIEWING')?.count ?? 0
                  : stats.data?.openRequisitions ?? 0
              }
            />
            <StatTile
              label="Offers & hires"
              value={
                (byStatus.find((row) => row.status === 'OFFER')?.count ?? 0) +
                (byStatus.find((row) => row.status === 'HIRED')?.count ?? 0)
              }
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            title="Pipeline by stage"
            subtitle="Counted server-side over the rows you are permitted to read."
          />
          {stats.isLoading ? (
            <div className="space-y-3 px-5 py-5">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-3" />
              ))}
            </div>
          ) : (
            <PipelineBars data={byStatus} />
          )}
        </Card>

        <Card>
          <CardHeader
            title={role === 'PANELIST' ? 'Your interview list' : 'Recent candidates'}
            action={
              <Link to="/candidates" className="text-[12px] font-medium text-brand hover:underline">
                View all
              </Link>
            }
          />
          {candidates.isLoading ? (
            <div className="space-y-3 px-5 py-5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          ) : candidates.data?.length ? (
            <ul className="divide-y divide-border">
              {candidates.data.slice(0, 5).map((candidate) => (
                <li key={candidate.id}>
                  <Link
                    to={`/candidates/${candidate.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-subtle"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {candidate.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {candidate.requisition.title}
                      </span>
                    </span>
                    <StatusPill status={candidate.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nothing assigned to you yet"
              description="Candidates appear here as soon as they fall inside your access scope."
            />
          )}
        </Card>
      </div>

      {role !== 'PANELIST' ? (
        <Card className="mt-5">
          <CardHeader
            title={role === 'ADMIN' ? 'All requisitions' : 'My requisitions'}
            action={
              <Link to="/requisitions" className="text-[12px] font-medium text-brand hover:underline">
                Manage
              </Link>
            }
          />
          {requisitions.isLoading ? (
            <div className="space-y-3 px-5 py-5">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          ) : requisitions.data?.length ? (
            <ul className="divide-y divide-border">
              {requisitions.data.slice(0, 4).map((requisition) => (
                <li key={requisition.id}>
                  <Link
                    to={`/requisitions/${requisition.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-subtle"
                  >
                    <span>
                      <span className="block text-[13px] font-medium text-ink">
                        {requisition.title}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {requisition.department} · {requisition.candidateCount} candidates · opened{' '}
                        {formatDate(requisition.createdAt)}
                      </span>
                    </span>
                    <StatusPill status={requisition.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No requisitions in your scope" />
          )}
        </Card>
      ) : null}
    </>
  );
}
