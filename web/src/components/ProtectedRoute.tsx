import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from '../context/SessionContext';
import type { Role } from '../lib/types';
import { AccessDenied } from './AccessDenied';
import { AppShell } from './AppShell';
import { Skeleton } from './ui';

/**
 * Route protection is a UX affordance — it stops people wandering into a screen
 * that would only render an error. It is *not* the security boundary: the same
 * request typed into a terminal is refused by the API regardless of what this
 * component decides.
 */
export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { session, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="w-full space-y-4 px-4 py-8 sm:px-5 lg:px-8 2xl:px-12">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (roles && !roles.includes(session.effectiveUser.role)) {
    return (
      <AppShell>
        <AccessDenied message="This area is not available for your current role." />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
