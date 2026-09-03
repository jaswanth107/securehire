import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar, Button, RolePill } from './ui';
import { PreviewBanner } from './PreviewBanner';
import type { Role } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: Role[];
  end?: boolean;
}

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    roles: ['ADMIN', 'RECRUITER', 'PANELIST'],
    icon: icon('M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z'),
  },
  {
    to: '/candidates',
    label: 'Candidates',
    roles: ['ADMIN', 'RECRUITER'],
    icon: icon('M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a4 4 0 0 1 0 7.75'),
  },
  {
    to: '/candidates',
    label: 'My Interviews',
    roles: ['PANELIST'],
    icon: icon('M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1'),
  },
  {
    to: '/requisitions',
    label: 'Requisitions',
    roles: ['ADMIN', 'RECRUITER'],
    icon: icon('M9 4h6a1 1 0 0 1 1 1v2H8V5a1 1 0 0 1 1-1M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M3 12h18'),
  },
  {
    to: '/users',
    label: 'Users',
    roles: ['ADMIN'],
    icon: icon('M17 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 8v6M22 11h-6'),
  },
  {
    to: '/preview',
    label: 'Preview mode',
    roles: ['ADMIN'],
    icon: icon('M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5'),
  },
];

function BrandMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </svg>
    </span>
  );
}

/**
 * The sidebar body, rendered twice: once as the permanent rail on large
 * screens, once inside the drawer on small ones. Keeping it in one place means
 * the two can never drift apart as nav items change.
 */
function SidebarContent({
  items,
  onNavigate,
  closeButton,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  closeButton?: ReactNode;
}) {
  const { session, logout } = useSession();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const effective = session!.effectiveUser;

  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandMark />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold tracking-tight text-ink">SecureHire</p>
          <p className="truncate text-[11px] text-faint">Hiring tracker</p>
        </div>
        {closeButton}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-muted hover:bg-subtle hover:text-ink'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={effective.name} role={effective.role} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{effective.name}</p>
            <p className="truncate text-[11px] text-faint">{effective.email}</p>
          </div>
        </div>
        <div className="mt-1 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={toggle}>
            {theme === 'dark' ? 'Light' : 'Dark'} mode
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            onClick={async () => {
              onNavigate?.();
              await logout();
              navigate('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, isPreview } = useSession();
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const [navPath, setNavPath] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Navigating away closes the drawer, including on programmatic redirects.
  // Adjusted during render rather than in an effect, so the drawer never paints
  // open on a route it no longer belongs to.
  if (pathname !== navPath) {
    setNavPath(pathname);
    setNavOpen(false);
  }

  // While the drawer is open it owns the screen: Escape closes it, the page
  // behind it does not scroll, and focus starts inside it.
  useEffect(() => {
    if (!navOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };

    // Captured now: the button outlives the drawer, and focus must return to it.
    const toggleButton = toggleRef.current;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      toggleButton?.focus();
    };
  }, [navOpen]);

  if (!session) return null;

  const effective = session.effectiveUser;
  // The sidebar is built from the *effective* role, but note that hiding a link
  // is a convenience only: the API refuses the same request either way.
  const items = NAV_ITEMS.filter((item) => item.roles.includes(effective.role));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      {/* Permanent rail — large screens. */}
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <SidebarContent items={items} />
      </aside>

      {/* Drawer — the same navigation, reachable on small screens. */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={() => setNavOpen(false)}
          />
          <aside
            id="app-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="drawer-in absolute inset-y-0 left-0 flex w-[min(84vw,288px)] flex-col border-r border-border bg-surface shadow-pop"
          >
            <SidebarContent
              items={items}
              onNavigate={() => setNavOpen(false)}
              closeButton={
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close navigation"
                  className="-mr-1 flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink"
                  onClick={() => setNavOpen(false)}
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              }
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col">
        {isPreview ? <PreviewBanner /> : null}

        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur sm:px-5 lg:px-8">
          <button
            ref={toggleRef}
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="app-navigation"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-subtle hover:text-ink lg:hidden"
            onClick={() => setNavOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <BrandMark />
            <span className="text-[14px] font-semibold tracking-tight text-ink">SecureHire</span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <span className="hidden text-[11px] uppercase tracking-wider text-faint sm:inline">
                {isPreview ? 'Previewing as' : 'Viewing as'}
              </span>
              <RolePill role={effective.role} />
              <span className="hidden truncate text-[12px] font-medium text-ink md:inline">{effective.name}</span>
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-5 sm:py-7 lg:px-8 2xl:px-12">{children}</main>
      </div>
    </div>
  );
}
