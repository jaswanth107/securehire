import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api';
import type { Requisition, User } from '../lib/types';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { REQUISITION_STATUSES, formatDate, titleCase } from '../lib/format';
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  Input,
  Modal,
  PageHeader,
  RolePill,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
} from '../components/ui';

export function RequisitionsPage() {
  const { session } = useSession();
  const isAdmin = session?.effectiveUser.role === 'ADMIN';
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [creating, setCreating] = useState(false);

  const requisitions = useQuery({
    queryKey: ['requisitions'],
    queryFn: () => api<Requisition[]>('/requisitions'),
  });

  const recruiters = useQuery({
    queryKey: ['users', 'recruiters'],
    enabled: isAdmin,
    queryFn: () => api<User[]>('/users?role=RECRUITER'),
  });

  const createRequisition = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Requisition>('/requisitions', { method: 'POST', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      setCreating(false);
      notify('Requisition created.');
    },
  });

  return (
    <>
      <PageHeader
        title={isAdmin ? 'All requisitions' : 'My requisitions'}
        description={
          isAdmin
            ? 'Every open role across the organisation, with its owning recruiter.'
            : 'Requisitions where you are the owning recruiter. Other recruiters’ roles are never returned to you.'
        }
        action={
          <Button onClick={() => setCreating(true)}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New requisition
          </Button>
        }
      />

      {requisitions.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : requisitions.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {requisitions.data.map((requisition) => (
            <Link
              key={requisition.id}
              to={`/requisitions/${requisition.id}`}
              className="card flex flex-col gap-3 p-5 transition hover:border-border-strong hover:shadow-pop"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                    {requisition.title}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted">{requisition.department}</p>
                </div>
                <StatusPill status={requisition.status} />
              </div>

              <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
                {requisition.description}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[12px] text-faint">
                <span className="flex items-center gap-1.5 text-muted">
                  <RolePill role="RECRUITER" />
                  {requisition.recruiter.name}
                </span>
                <span>{requisition.candidateCount} candidates</span>
                <span className="ml-auto">Opened {formatDate(requisition.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No requisitions in your scope"
            description="Create one to start tracking candidates against it."
            action={<Button onClick={() => setCreating(true)}>New requisition</Button>}
          />
        </Card>
      )}

      {creating ? (
        <Modal
          title="New requisition"
          description={
            isAdmin
              ? 'As an admin you choose the owning recruiter.'
              : 'You are recorded as the owner — the server takes ownership from your session, not this form.'
          }
          onClose={() => setCreating(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createRequisition.mutate({
                title: form.get('title'),
                department: form.get('department'),
                description: form.get('description'),
                status: form.get('status'),
                ...(isAdmin ? { recruiterId: form.get('recruiterId') } : {}),
              });
            }}
          >
            {createRequisition.error ? (
              <ErrorNotice
                message={
                  createRequisition.error instanceof ApiError
                    ? createRequisition.error.message
                    : 'Could not create the requisition.'
                }
              />
            ) : null}

            <Field label="Title">
              <Input name="title" required minLength={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department">
                <Input name="department" required minLength={2} />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="OPEN">
                  {REQUISITION_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {titleCase(option)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {isAdmin ? (
              <Field label="Owning recruiter">
                <Select name="recruiterId" required>
                  <option value="">Select a recruiter…</option>
                  {recruiters.data?.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Description">
              <Textarea name="description" rows={4} required minLength={2} />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRequisition.isPending}>
                {createRequisition.isPending ? 'Creating…' : 'Create requisition'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
