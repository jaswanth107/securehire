import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { Button, RolePill } from './ui';

/**
 * An impersonated session must never be mistaken for a real one, so the banner
 * states both identities explicitly: who is actually signed in, and whose
 * permissions are currently in force.
 */
export function PreviewBanner() {
  const { session, exitPreview } = useSession();
  const navigate = useNavigate();

  if (!session?.isPreview) return null;

  return (
    <div className="preview-hatch border-b border-warn/35 bg-warn-soft">
      <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-5 lg:px-8 2xl:px-12">
        <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-warn">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          Admin preview mode
        </span>

        <span className="text-[12px] text-warn">
          Authenticated as <strong className="font-semibold">{session.authenticatedUser.name}</strong>{' '}
          (Admin) · viewing as{' '}
          <strong className="font-semibold">{session.effectiveUser.name}</strong>
        </span>

        <RolePill role={session.effectiveUser.role} />

        <Button
          variant="secondary"
          className="ml-auto"
          onClick={async () => {
            await exitPreview();
            navigate('/');
          }}
        >
          Exit preview
        </Button>
      </div>
    </div>
  );
}
