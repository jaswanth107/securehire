import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { ApiError } from '../lib/api';
import { Button, ErrorNotice, Field, Input } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@example.com', tone: 'text-role-admin bg-role-admin-soft' },
  { label: 'Recruiter A', email: 'recruiter.a@example.com', tone: 'text-role-recruiter bg-role-recruiter-soft' },
  { label: 'Recruiter B', email: 'recruiter.b@example.com', tone: 'text-role-recruiter bg-role-recruiter-soft' },
  { label: 'Panelist A', email: 'panelist.a@example.com', tone: 'text-role-panelist bg-role-panelist-soft' },
  { label: 'Panelist B', email: 'panelist.b@example.com', tone: 'text-role-panelist bg-role-panelist-soft' },
];

export function LoginPage() {
  const { session, login, isLoading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!isLoading && session) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to sign in right now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-white">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight text-ink">SecureHire</p>
              <p className="text-[11px] text-faint">Role-based hiring tracker</p>
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-[13px] text-muted">
            Your role decides what the server will return — not what this page renders.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <ErrorNotice message={error} /> : null}

            <Field label="Work email">
              <Input
                type="email"
                autoComplete="username"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 rounded-lg border border-border bg-subtle px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              Local demo accounts
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('Password123!');
                  }}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition hover:brightness-95 ${account.tone}`}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-faint">
              All seeded accounts use <code className="text-muted">Password123!</code> in local
              development only.
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 opacity-90 [background:radial-gradient(120%_120%_at_15%_10%,#4f46e5_0%,#1e1b4b_45%,#0b0f1c_100%)]" />
        <div className="relative flex h-full flex-col justify-center gap-8 px-14 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Authorization model
            </p>
            <h2 className="mt-3 max-w-md text-2xl font-semibold leading-snug">
              Every role sees exactly what it is allowed to see — enforced in the query, not in the
              interface.
            </h2>
          </div>

          <ul className="space-y-4 text-[13px] text-white/80">
            <li className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/70" />
              <span>
                <strong className="font-semibold text-white">Admins</strong> read the whole pipeline
                and can preview the product as any other user without changing a stored role.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/70" />
              <span>
                <strong className="font-semibold text-white">Recruiters</strong> are scoped to the
                requisitions they own; ownership comes from the session, never the request.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/70" />
              <span>
                <strong className="font-semibold text-white">Panelists</strong> see only candidates
                with an explicit assignment record — not everyone in the requisition.
              </span>
            </li>
          </ul>

          <div className="rounded-xl border border-white/15 bg-white/5 p-4 font-mono text-[11px] leading-relaxed text-white/70">
            GET /api/candidates<br />
            Authorization: Bearer &lt;recruiterA&gt;<br />
            <span className="text-emerald-300">→ 200</span> 2 rows (own requisition only)<br />
            <br />
            GET /api/candidates/&lt;recruiterB-candidate&gt;<br />
            <span className="text-rose-300">→ 403</span> FORBIDDEN — no payload
          </div>
        </div>
      </div>
    </div>
  );
}
