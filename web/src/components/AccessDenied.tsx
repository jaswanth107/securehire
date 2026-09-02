import { Link } from 'react-router-dom';
import { Button, Card } from './ui';

/**
 * What a blocked request looks like in the UI. The server sends the same body
 * whether the record is missing or simply not yours, so this screen deliberately
 * cannot say which — that is the point.
 */
export function AccessDenied({ message }: { message?: string }) {
  return (
    <Card className="mx-auto max-w-lg px-8 py-12 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Access denied</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted">
        {message ?? 'You do not have permission to access this resource.'}
      </p>
      <p className="mx-auto mt-3 max-w-sm text-[12px] text-faint">
        The server refused this request — the record was never sent to your browser.
      </p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </Card>
  );
}
