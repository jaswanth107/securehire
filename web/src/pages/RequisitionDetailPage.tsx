import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api';
import type { Candidate, Requisition } from '../lib/types';
import { useToast } from '../context/ToastContext';
import { REQUISITION_STATUSES, formatDate, titleCase } from '../lib/format';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
} from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

export function RequisitionDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const requisition = useQuery({
    queryKey: ['requisition', id],
    retry: false,
    queryFn: () => api<Requisition>(`/requisitions/${id}`),
  });

  const candidates = useQuery({
    queryKey: ['candidates', { requisitionId: id }],
    enabled: requisition.isSuccess,
    queryFn: () => api<Candidate[]>(`/candidates?requisitionId=${id}`),
  });

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Requisition>(`/requisitions/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requisition', id] });
      void queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      notify('Requisition updated.');
    },
    onError: (error) =>
      notify(error instanceof ApiError ? error.message : 'Update failed.', 'error'),
  });

  if (requisition.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (requisition.error) {
    const error = requisition.error;
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return <AccessDenied message={error.message} />;
    }
    return <ErrorNotice message="Could not load this requisition." />;
  }

  const data = requisition.data!;

  return (
    <>
      <Link
        to="/requisitions"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m14 6-6 6 6 6" />
        </svg>
        Back to requisitions
      </Link>

      <PageHeader
        title={data.title}
        description={`${data.department} · opened ${formatDate(data.createdAt)}`}
        action={<StatusPill status={data.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Requisition details" />
          <form
            className="space-y-4 px-5 py-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              update.mutate({
                title: form.get('title'),
                department: form.get('department'),
                description: form.get('description'),
                status: form.get('status'),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <Input name="title" defaultValue={data.title} required />
              </Field>
              <Field label="Department">
                <Input name="department" defaultValue={data.department} required />
              </Field>
            </div>
            <Field label="Status">
              <Select name="status" defaultValue={data.status}>
                {REQUISITION_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description">
              <Textarea name="description" rows={5} defaultValue={data.description} required />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Owner" subtitle="Ownership decides who else can read this data." />
            <div className="flex items-center gap-3 px-5 py-4">
              <Avatar name={data.recruiter.name} role="RECRUITER" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{data.recruiter.name}</p>
                <p className="truncate text-[12px] text-faint">{data.recruiter.email}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Candidates (${data.candidateCount})`} />
            {candidates.isLoading ? (
              <div className="space-y-2 px-5 py-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-9" />
                ))}
              </div>
            ) : candidates.data?.length ? (
              <ul className="divide-y divide-border">
                {candidates.data.map((candidate) => (
                  <li key={candidate.id}>
                    <Link
                      to={`/candidates/${candidate.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-subtle"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {candidate.name}
                        </span>
                        <span className="block truncate text-[12px] text-faint">
                          {candidate.email}
                        </span>
                      </span>
                      <StatusPill status={candidate.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No candidates yet" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
