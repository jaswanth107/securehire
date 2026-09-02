/**
 * Thin API client.
 *
 * Two things matter here:
 *  1. `credentials: 'include'` — the session lives in an HTTP-only cookie the
 *     JavaScript here cannot read, so there is no token to steal from storage.
 *  2. The preview header is a *request* for impersonation, never a grant. The
 *     server refuses it unless the authenticated identity is an admin, so a
 *     tampered value in localStorage buys nothing.
 */

const PREVIEW_STORAGE_KEY = 'securehire.previewUserId';

let previewUserId: string | null = readStoredPreview();

function readStoredPreview(): string | null {
  try {
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getPreviewUserId(): string | null {
  return previewUserId;
}

export function setPreviewUserId(id: string | null): void {
  previewUserId = id;
  try {
    if (id) window.localStorage.setItem(PREVIEW_STORAGE_KEY, id);
    else window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  } catch {
    /* Storage is a convenience only; the session itself lives in the cookie. */
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the preview header (used by the endpoints that manage preview). */
  ignorePreview?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (previewUserId && !options.ignorePreview) headers['X-Preview-As-User'] = previewUserId;

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? 'UNKNOWN',
      error.message ?? 'Request failed.',
    );
  }

  return payload.data as T;
}
