import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import type { User } from '../lib/types';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/format';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  PageHeader,
  RolePill,
  Skeleton,
} from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

export function UsersPage() {
  const { session, startPreview } = useSession();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const navigate = useNavigate();

  const users = useQuery({
    queryKey: ['users'],
    retry: false,
    queryFn: () => api<User[]>('/users'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api<User>(`/users/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      notify(`${user.name} ${user.isActive ? 'reactivated' : 'deactivated'}.`);
    },
    onError: (error) =>
      notify(error instanceof ApiError ? error.message : 'Could not update the account.', 'error'),
  });

  if (users.error) {
    const error = users.error;
    if (error instanceof ApiError && error.status === 403) return <AccessDenied message={error.message} />;
    return <ErrorNotice message="Could not load users." />;
  }

  return (
    <>
      <PageHeader
        title="User management"
        description="Deactivating an account invalidates its existing sessions on the very next request."
      />

      <Card>
        <CardHeader title="Directory" subtitle="Admin-only. Other roles receive 403 from this endpoint." />
        {users.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.data?.map((user) => {
                  const isSelf = user.id === session?.authenticatedUser.id;
                  return (
                    <tr key={user.id} className="transition hover:bg-subtle">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} role={user.role} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {user.name}
                              {isSelf ? <span className="ml-2 text-[11px] text-faint">you</span> : null}
                            </p>
                            <p className="truncate text-[12px] text-faint">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <RolePill role={user.role} />
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                            user.isActive ? 'text-success' : 'text-danger'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              user.isActive ? 'bg-success' : 'bg-danger'
                            }`}
                          />
                          {user.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">{formatDate(user.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          {!isSelf && user.isActive ? (
                            <Button
                              variant="secondary"
                              onClick={async () => {
                                await startPreview(user.id);
                                navigate('/');
                              }}
                            >
                              Preview as
                            </Button>
                          ) : null}
                          {!isSelf ? (
                            <Button
                              variant={user.isActive ? 'danger' : 'secondary'}
                              onClick={() =>
                                setActive.mutate({ id: user.id, isActive: !user.isActive })
                              }
                            >
                              {user.isActive ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
