import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg px-8 py-14 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-faint">404</p>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 text-[13px] text-muted">
        The page you were looking for does not exist in SecureHire.
      </p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </Card>
  );
}
