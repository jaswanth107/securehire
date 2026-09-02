import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { CandidateStatus, RequisitionStatus, Role } from '../lib/types';
import { titleCase } from '../lib/format';

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                          */
/* -------------------------------------------------------------------------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-subtle',
  ghost: 'text-muted hover:bg-subtle hover:text-ink',
  danger: 'bg-danger-soft text-danger border border-transparent hover:brightness-95',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

const FIELD_CLASS =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint transition focus:border-brand focus:outline-none';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASS} ${className}`} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD_CLASS} min-h-24 resize-y ${className}`} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_CLASS} ${className}`} />;
}

/* -------------------------------------------------------------------------- */
/* Status and role indicators                                                 */
/* -------------------------------------------------------------------------- */

const CANDIDATE_STATUS_STYLE: Record<CandidateStatus, string> = {
  APPLIED: 'bg-subtle text-muted',
  SCREENING: 'bg-info-soft text-info',
  INTERVIEWING: 'bg-brand-soft text-brand-ink',
  OFFER: 'bg-warn-soft text-warn',
  HIRED: 'bg-success-soft text-success',
  REJECTED: 'bg-danger-soft text-danger',
};

const REQUISITION_STATUS_STYLE: Record<RequisitionStatus, string> = {
  OPEN: 'bg-success-soft text-success',
  ON_HOLD: 'bg-warn-soft text-warn',
  CLOSED: 'bg-subtle text-muted',
};

export function StatusPill({ status }: { status: CandidateStatus | RequisitionStatus }) {
  const style =
    (CANDIDATE_STATUS_STYLE as Record<string, string>)[status] ??
    (REQUISITION_STATUS_STYLE as Record<string, string>)[status] ??
    'bg-subtle text-muted';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${style}`}>
      {titleCase(status)}
    </span>
  );
}

const ROLE_STYLE: Record<Role, string> = {
  ADMIN: 'bg-role-admin-soft text-role-admin',
  RECRUITER: 'bg-role-recruiter-soft text-role-recruiter',
  PANELIST: 'bg-role-panelist-soft text-role-panelist',
};

export function RolePill({ role, className = '' }: { role: Role; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${ROLE_STYLE[role]} ${className}`}>
      {titleCase(role)}
    </span>
  );
}

export function Avatar({ name, role }: { name: string; role?: Role }) {
  const tone = role ? ROLE_STYLE[role] : 'bg-brand-soft text-brand-ink';
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${tone}`}>
      {name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback states                                                            */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-subtle text-faint">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger">
      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.2v.1" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-lg shadow-pop">
        <CardHeader
          title={title}
          subtitle={description}
          action={
            <Button variant="ghost" onClick={onClose} aria-label="Close dialog" className="px-2">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </Button>
          }
        />
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
