import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
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
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout, isPreview } = useSession();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  if (!session) return null;

  const effective = session.effectiveUser;
  // The sidebar is built from the *effective* role, but note that hiding a link
  // is a convenience only: the API refuses the same request either way.
  const items = NAV_ITEMS.filter((item) => item.roles.includes(effective.role));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" />
              <path d="m9 12 2.2 2.2L15.5 10" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold tracking-tight text-ink">SecureHire</p>
            <p className="text-[11px] text-faint">Hiring tracker</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
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
                await logout();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {isPreview ? <PreviewBanner /> : null}

        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-surface/85 px-5 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3 overflow-x-auto lg:hidden">
            {items.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${
                    isActive ? 'bg-brand-soft text-brand-ink' : 'text-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <span className="text-[11px] uppercase tracking-wider text-faint">
                {isPreview ? 'Previewing as' : 'Viewing as'}
              </span>
              <RolePill role={effective.role} />
              <span className="hidden text-[12px] font-medium text-ink sm:inline">{effective.name}</span>
            </div>
            <Button variant="ghost" className="lg:hidden" onClick={toggle} aria-label="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </Button>
            <Button
              variant="ghost"
              className="lg:hidden"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
