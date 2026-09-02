import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import type { Role, User } from '../lib/types';
import { useSession } from '../context/SessionContext';
import { Avatar, Button, Card, CardHeader, ErrorNotice, PageHeader, RolePill, Skeleton } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

const ROLE_ORDER: Role[] = ['ADMIN', 'RECRUITER', 'PANELIST'];

const ROLE_BLURB: Record<Role, string> = {
  ADMIN: 'Unrestricted access to every requisition, candidate and assignment.',
  RECRUITER: 'Scoped to the requisitions this recruiter owns.',
  PANELIST: 'Scoped to candidates with an assignment record naming this panelist.',
};

export function PreviewPage() {
  const { session, startPreview, exitPreview, isPreview } = useSession();
  const navigate = useNavigate();

  const users = useQuery({
    queryKey: ['preview-users'],
    retry: false,
    queryFn: () => api<User[]>('/preview/users'),
  });

  if (users.error) {
    const error = users.error;
    if (error instanceof ApiError && error.status === 403) return <AccessDenied message={error.message} />;
    return <ErrorNotice message="Could not load the preview roster." />;
  }

  return (
    <>
      <PageHeader
        title="Preview as another user"
        description="See the product exactly as another user sees it, without changing a single stored role."
        action={
          isPreview ? (
            <Button
              variant="secondary"
              onClick={async () => {
                await exitPreview();
                navigate('/');
              }}
            >
              Exit preview
            </Button>
          ) : null
        }
      />

      <Card className="mb-5 px-5 py-4">
        <h2 className="text-[13px] font-semibold text-ink">How this stays safe</h2>
        <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted">
          <li>
            · Preview sends an <code className="text-ink">X-Preview-As-User</code> header. The server
            honours it only when the <em>authenticated</em> identity is an admin — a recruiter
            sending the same header gets 403.
          </li>
          <li>
            · <code className="text-ink">User.role</code> is never written. The preview lives entirely
            in the request, so nothing is left behind if the tab is closed mid-session.
          </li>
          <li>
            · Authorization runs against the previewed user's real permissions, so while previewing
            you genuinely lose your own admin reach — including on writes.
          </li>
        </ul>
      </Card>

      {users.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {ROLE_ORDER.map((role) => {
            const roleUsers = users.data?.filter((user) => user.role === role) ?? [];
            if (roleUsers.length === 0) return null;

            return (
              <Card key={role}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <RolePill role={role} />
                      <span className="text-muted">{ROLE_BLURB[role]}</span>
                    </span>
                  }
                />
                <ul className="divide-y divide-border">
                  {roleUsers.map((user) => {
                    const isCurrent = session?.effectiveUser.id === user.id;
                    const isSelf = session?.authenticatedUser.id === user.id;
                    return (
                      <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar name={user.name} role={user.role} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
                          <p className="truncate text-[12px] text-faint">{user.email}</p>
                        </div>
                        {isSelf ? (
                          <span className="text-[12px] text-faint">Your account</span>
                        ) : isCurrent ? (
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              await exitPreview();
                              navigate('/');
                            }}
                          >
                            Currently previewing · exit
                          </Button>
                        ) : (
                          <Button
                            onClick={async () => {
                              await startPreview(user.id);
                              navigate('/');
                            }}
                          >
                            Preview as {user.name.split(' ')[0]}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
