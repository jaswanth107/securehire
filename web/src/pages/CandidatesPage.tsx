import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api';
import type { Candidate, Requisition } from '../lib/types';
import { useSession } from '../context/SessionContext';
import { CANDIDATE_STATUSES, formatDate, titleCase } from '../lib/format';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
} from '../components/ui';

export function CandidatesPage() {
  const { session } = useSession();
  const role = session?.effectiveUser.role;
  const isPanelist = role === 'PANELIST';
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [requisitionId, setRequisitionId] = useState('');
  const [creating, setCreating] = useState(false);

  const candidates = useQuery({
    queryKey: ['candidates', { search, status, requisitionId }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (requisitionId) params.set('requisitionId', requisitionId);
      const query = params.toString();
      return api<Candidate[]>(`/candidates${query ? `?${query}` : ''}`);
    },
  });

  const requisitions = useQuery({
    queryKey: ['requisitions'],
    enabled: !isPanelist,
    queryFn: () => api<Requisition[]>('/requisitions'),
  });

  const createCandidate = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Candidate>('/candidates', { method: 'POST', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      // The change just made is an audit entry now, so the feed and badge follow.
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      setCreating(false);
      notify('Candidate added.');
    },
  });

  const openRequisitions = useMemo(
    () => requisitions.data?.filter((requisition) => requisition.status !== 'CLOSED') ?? [],
    [requisitions.data],
  );

  return (
    <>
      <PageHeader
        title={isPanelist ? 'My interviews' : 'Candidates'}
        description={
          isPanelist
            ? 'Candidates with an explicit assignment record naming you. Contact details stay with the recruiter.'
            : role === 'ADMIN'
              ? 'Every candidate across every requisition.'
              : 'Candidates inside the requisitions you own.'
        }
        action={
          isPanelist ? null : (
            <Button onClick={() => setCreating(true)} disabled={openRequisitions.length === 0}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New candidate
            </Button>
          )
        }
      />

      <Card className="mb-5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <Input
              className="pl-9"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select
            className="w-44"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All stages</option>
            {CANDIDATE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>

          {!isPanelist ? (
            <Select
              className="w-56"
              value={requisitionId}
              onChange={(event) => setRequisitionId(event.target.value)}
              aria-label="Filter by requisition"
            >
              <option value="">All requisitions</option>
              {requisitions.data?.map((requisition) => (
                <option key={requisition.id} value={requisition.id}>
                  {requisition.title}
                </option>
              ))}
            </Select>
          ) : null}

          {search || status || requisitionId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setRequisitionId('');
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </Card>

      <Card>
        {candidates.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : candidates.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  {!isPanelist ? <th className="px-5 py-3 font-semibold">Contact</th> : null}
                  <th className="px-5 py-3 font-semibold">Requisition</th>
                  <th className="px-5 py-3 font-semibold">Stage</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.data.map((candidate) => (
                  <tr key={candidate.id} className="transition hover:bg-subtle">
                    <td className="px-5 py-3">
                      <Link
                        to={`/candidates/${candidate.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {candidate.name}
                      </Link>
                    </td>
                    {!isPanelist ? (
                      <td className="px-5 py-3 text-muted">
                        <span className="block">{candidate.email}</span>
                        <span className="block text-[12px] text-faint">{candidate.phone}</span>
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-muted">
                      <span className="block">{candidate.requisition.title}</span>
                      <span className="block text-[12px] text-faint">
                        {candidate.requisition.department}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={candidate.status} />
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(candidate.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No candidates match your access scope"
            description={
              isPanelist
                ? 'You will see a candidate here once a recruiter or admin assigns you to their panel.'
                : 'Adjust the filters, or add a candidate to one of your requisitions.'
            }
          />
        )}
      </Card>

      {creating ? (
        <Modal
          title="New candidate"
          description="The requisition list below is already limited to requisitions you own."
          onClose={() => setCreating(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createCandidate.mutate({
                name: form.get('name'),
                email: form.get('email'),
                phone: form.get('phone'),
                status: form.get('status'),
                requisitionId: form.get('requisitionId'),
                notes: (form.get('notes') as string) || undefined,
              });
            }}
          >
            {createCandidate.error ? (
              <ErrorNotice
                message={
                  createCandidate.error instanceof ApiError
                    ? createCandidate.error.message
                    : 'Could not create the candidate.'
                }
              />
            ) : null}

            <Field label="Full name">
              <Input name="name" required minLength={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input name="email" type="email" required />
              </Field>
              <Field label="Phone">
                <Input name="phone" required minLength={5} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Requisition">
                <Select name="requisitionId" required>
                  {openRequisitions.map((requisition) => (
                    <option key={requisition.id} value={requisition.id}>
                      {requisition.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Stage">
                <Select name="status" defaultValue="APPLIED">
                  {CANDIDATE_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {titleCase(option)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Notes" hint="Visible to admins and the owning recruiter only.">
              <Textarea name="notes" rows={3} />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCandidate.isPending}>
                {createCandidate.isPending ? 'Saving…' : 'Add candidate'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
