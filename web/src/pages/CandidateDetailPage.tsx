import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api';
import type { CandidateDetail, User } from '../lib/types';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { CANDIDATE_STATUSES, formatDate, titleCase } from '../lib/format';
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

export function CandidateDetailPage() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const role = session?.effectiveUser.role;
  const isPanelist = role === 'PANELIST';
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [panelistToAdd, setPanelistToAdd] = useState('');

  const candidate = useQuery({
    queryKey: ['candidate', id],
    retry: false,
    queryFn: () => api<CandidateDetail>(`/candidates/${id}`),
  });

  const panelists = useQuery({
    queryKey: ['panelists'],
    enabled: !isPanelist,
    queryFn: () => api<User[]>('/users/panelists'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['candidate', id] });
    void queryClient.invalidateQueries({ queryKey: ['candidates'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  const updateCandidate = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<CandidateDetail>(`/candidates/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: () => {
      invalidate();
      notify('Candidate updated.');
    },
    onError: (error) =>
      notify(error instanceof ApiError ? error.message : 'Update failed.', 'error'),
  });

  const deleteCandidate = useMutation({
    mutationFn: () => api(`/candidates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notify('Candidate removed.');
      navigate('/candidates');
    },
    onError: (error) =>
      notify(error instanceof ApiError ? error.message : 'Delete failed.', 'error'),
  });

  const assignPanelist = useMutation({
    mutationFn: (panelistId: string) =>
      api(`/candidates/${id}/panelists`, { method: 'POST', body: { panelistId } }),
    onSuccess: () => {
      invalidate();
      setPanelistToAdd('');
      notify('Panelist assigned — they can now see this candidate.');
    },
    onError: (error) =>
      notify(error instanceof ApiError ? error.message : 'Assignment failed.', 'error'),
  });

  const removePanelist = useMutation({
    mutationFn: (panelistId: string) =>
      api(`/candidates/${id}/panelists/${panelistId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notify('Panelist removed — their access ends immediately.');
    },
  });

  const submitFeedback = useMutation({
    mutationFn: (payload: { rating: number; feedback: string }) =>
      api(`/candidates/${id}/feedback`, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
      notify('Feedback submitted.');
    },
    onError: (error) =>
      notify(error instanceof ApiError ? error.message : 'Could not submit feedback.', 'error'),
  });

  if (candidate.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (candidate.error) {
    const error = candidate.error;
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return <AccessDenied message={error.message} />;
    }
    return <ErrorNotice message="Could not load this candidate." />;
  }

  const data = candidate.data!;
  const assignedIds = new Set((data.panelists ?? []).map((panelist) => panelist.id));
  const availablePanelists = (panelists.data ?? []).filter(
    (panelist) => !assignedIds.has(panelist.id),
  );

  return (
    <>
      <Link
        to="/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m14 6-6 6 6 6" />
        </svg>
        Back to candidates
      </Link>

      <PageHeader
        title={data.name}
        description={`${data.requisition.title} · ${data.requisition.department}`}
        action={<StatusPill status={data.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          {isPanelist ? (
            <Card>
              <CardHeader
                title="Interview brief"
                subtitle="Panelists receive the details needed to run the interview — contact information stays with the recruiter."
              />
              <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">Candidate</dt>
                  <dd className="mt-1 text-[13px] text-ink">{data.name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">Stage</dt>
                  <dd className="mt-1"><StatusPill status={data.status} /></dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">Requisition</dt>
                  <dd className="mt-1 text-[13px] text-ink">{data.requisition.title}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">Assigned since</dt>
                  <dd className="mt-1 text-[13px] text-ink">{formatDate(data.createdAt)}</dd>
                </div>
              </dl>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Candidate record" subtitle="Editable by admins and the owning recruiter." />
              <form
                className="space-y-4 px-5 py-5"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  updateCandidate.mutate({
                    name: form.get('name'),
                    email: form.get('email'),
                    phone: form.get('phone'),
                    status: form.get('status'),
                    notes: (form.get('notes') as string) || '',
                  });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <Input name="name" defaultValue={data.name} required />
                  </Field>
                  <Field label="Stage">
                    <Select name="status" defaultValue={data.status}>
                      {CANDIDATE_STATUSES.map((option) => (
                        <option key={option} value={option}>
                          {titleCase(option)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Email">
                    <Input name="email" type="email" defaultValue={data.email} required />
                  </Field>
                  <Field label="Phone">
                    <Input name="phone" defaultValue={data.phone} required />
                  </Field>
                </div>
                <Field label="Recruiter notes">
                  <Textarea name="notes" rows={3} defaultValue={data.notes ?? ''} />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete ${data.name}? This cannot be undone.`)) {
                        deleteCandidate.mutate();
                      }
                    }}
                  >
                    Delete candidate
                  </Button>
                  <Button type="submit" disabled={updateCandidate.isPending}>
                    {updateCandidate.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {isPanelist ? (
            <Card>
              <CardHeader
                title="Interview feedback"
                subtitle={
                  data.myFeedback
                    ? 'Your scorecard. Only you, the owning recruiter and admins can read it.'
                    : 'Submit your scorecard for this interview.'
                }
              />
              <form
                className="space-y-4 px-5 py-5"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  submitFeedback.mutate({
                    rating: Number(form.get('rating')),
                    feedback: String(form.get('feedback')),
                  });
                }}
              >
                <Field label="Rating">
                  <Select name="rating" defaultValue={String(data.myFeedback?.rating ?? 3)}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value} — {['Strong no', 'No', 'Mixed', 'Yes', 'Strong yes'][value - 1]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notes" hint="Minimum 5 characters.">
                  <Textarea
                    name="feedback"
                    rows={5}
                    required
                    minLength={5}
                    defaultValue={data.myFeedback?.feedback ?? ''}
                    placeholder="What did you probe, and what did you conclude?"
                  />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-faint">
                    {data.myFeedback
                      ? `Last saved ${formatDate(data.myFeedback.updatedAt ?? data.myFeedback.createdAt)}`
                      : 'Not submitted yet'}
                  </span>
                  <Button type="submit" disabled={submitFeedback.isPending}>
                    {submitFeedback.isPending ? 'Saving…' : data.myFeedback ? 'Update feedback' : 'Submit feedback'}
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Panel feedback" subtitle="Scorecards from every assigned interviewer." />
              {data.feedback?.length ? (
                <ul className="divide-y divide-border">
                  {data.feedback.map((entry) => (
                    <li key={entry.id} className="flex gap-3 px-5 py-4">
                      <Avatar name={entry.panelist.name} role={entry.panelist.role} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">
                            {entry.panelist.name}
                          </span>
                          <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand-ink">
                            {entry.rating}/5
                          </span>
                          <span className="text-[11px] text-faint">{formatDate(entry.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{entry.feedback}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No feedback yet"
                  description="Scorecards appear here once assigned panelists submit them."
                />
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {!isPanelist ? (
            <Card>
              <CardHeader
                title="Interview panel"
                subtitle="Assignment is what grants a panelist access to this candidate."
              />
              <div className="px-5 py-4">
                <div className="flex gap-2">
                  <Select
                    value={panelistToAdd}
                    onChange={(event) => setPanelistToAdd(event.target.value)}
                    aria-label="Panelist to assign"
                  >
                    <option value="">Select a panelist…</option>
                    {availablePanelists.map((panelist) => (
                      <option key={panelist.id} value={panelist.id}>
                        {panelist.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={!panelistToAdd || assignPanelist.isPending}
                    onClick={() => assignPanelist.mutate(panelistToAdd)}
                  >
                    Assign
                  </Button>
                </div>
              </div>
              {data.panelists?.length ? (
                <ul className="divide-y divide-border border-t border-border">
                  {data.panelists.map((panelist) => (
                    <li key={panelist.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={panelist.name} role="PANELIST" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{panelist.name}</p>
                        <p className="truncate text-[11px] text-faint">
                          Assigned {formatDate(panelist.assignedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => removePanelist.mutate(panelist.id)}
                        aria-label={`Remove ${panelist.name}`}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No panelists assigned"
                  description="Until someone is assigned here, no panelist can read this record."
                />
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Access summary" />
            <ul className="space-y-3 px-5 py-5 text-[12px] text-muted">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-role-admin" />
                <span>Admins can always read and edit this record.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-role-recruiter" />
                <span>
                  The recruiter who owns <strong className="text-ink">{data.requisition.title}</strong>{' '}
                  can read and edit it. Other recruiters receive 403.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-role-panelist" />
                <span>
                  {isPanelist
                    ? 'You can read it because an assignment record names you.'
                    : `${data.panelists?.length ?? 0} panelist(s) can read a reduced version of it.`}
                </span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
