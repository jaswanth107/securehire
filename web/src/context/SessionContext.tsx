import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, getPreviewUserId, setPreviewUserId } from '../lib/api';
import type { Session } from '../lib/types';

interface SessionValue {
  session: Session | null;
  isLoading: boolean;
  /** The identity the UI should be rendered for (previewed user when active). */
  effectiveRole: Session['effectiveUser']['role'] | null;
  isPreview: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  startPreview: (userId: string) => Promise<void>;
  exitPreview: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [previewId, setPreviewIdState] = useState<string | null>(getPreviewUserId());

  const sessionQuery = useQuery({
    queryKey: ['session', previewId],
    retry: false,
    queryFn: async (): Promise<Session | null> => {
      try {
        return await api<Session>('/auth/me');
      } catch (error) {
        // A preview target that was deleted or deactivated makes every request
        // fail; drop the preview and fall back to the real admin session rather
        // than stranding the user on a broken screen.
        if (error instanceof ApiError && error.status === 403 && getPreviewUserId()) {
          setPreviewUserId(null);
          setPreviewIdState(null);
          return api<Session>('/auth/me');
        }
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });

  const applyPreview = useCallback(
    async (userId: string | null) => {
      setPreviewUserId(userId);
      setPreviewIdState(userId);
      // Everything cached was scoped to the previous identity, so it is dropped
      // rather than reused. The session query itself is keyed by the preview id,
      // so switching identities refetches it automatically.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    },
    [queryClient],
  );

  /** Re-reads /auth/me and waits for it, so callers can navigate afterwards. */
  const refreshSession = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ['session'] });
  }, [queryClient]);

  const value = useMemo<SessionValue>(() => {
    const session = sessionQuery.data ?? null;
    return {
      session,
      isLoading: sessionQuery.isLoading,
      effectiveRole: session?.effectiveUser.role ?? null,
      isPreview: Boolean(session?.isPreview),
      async login(email, password) {
        await api('/auth/login', { method: 'POST', body: { email, password }, ignorePreview: true });
        await applyPreview(null);
        await refreshSession();
      },
      async logout() {
        await api('/auth/logout', { method: 'POST', ignorePreview: true }).catch(() => undefined);
        await applyPreview(null);
        await refreshSession();
      },
      async startPreview(userId) {
        await applyPreview(userId);
      },
      async exitPreview() {
        await applyPreview(null);
      },
    };
  }, [applyPreview, refreshSession, sessionQuery.data, sessionQuery.isLoading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>.');
  return context;
}
