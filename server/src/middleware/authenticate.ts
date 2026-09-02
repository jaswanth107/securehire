import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AUTH_COOKIE, verifyToken } from '../lib/jwt.js';
import { forbidden, unauthenticated } from '../lib/errors.js';
import type { RequestUser } from '../types/express.js';

export const PREVIEW_HEADER = 'x-preview-as-user';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
} as const;

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();

  return null;
}

/**
 * Establishes `req.authenticatedUser` from the verified token, then resolves
 * `req.effectiveUser` (which may differ only for an admin using preview mode).
 *
 * Nothing in the request body or query string participates in this decision.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw unauthenticated();

    const payload = verifyToken(token);
    if (!payload) throw unauthenticated('Invalid or expired session.');

    // Re-read the user every request: role changes and deactivations take
    // effect immediately rather than at token expiry.
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: SAFE_USER_SELECT,
    });
    if (!dbUser || !dbUser.isActive) throw unauthenticated('Invalid or expired session.');

    const authenticatedUser: RequestUser = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    };
    req.authenticatedUser = authenticatedUser;

    const effectiveUser = await resolveEffectiveUser(req, authenticatedUser);
    req.effectiveUser = effectiveUser;
    req.user = effectiveUser;
    req.isPreview = effectiveUser.id !== authenticatedUser.id;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Preview mode. The `X-Preview-As-User` header is honoured **only** when the
 * proven identity is an ADMIN; any other caller sending it is treated as an
 * attempted privilege escalation and rejected outright rather than ignored.
 */
async function resolveEffectiveUser(
  req: Request,
  authenticatedUser: RequestUser,
): Promise<RequestUser> {
  const rawHeader = req.headers[PREVIEW_HEADER];
  const previewUserId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (!previewUserId || previewUserId.trim() === '') return authenticatedUser;

  if (authenticatedUser.role !== 'ADMIN') {
    throw forbidden('Preview mode is restricted to administrators.');
  }

  const previewUser = await prisma.user.findUnique({
    where: { id: previewUserId.trim() },
    select: SAFE_USER_SELECT,
  });

  // A deleted or deactivated preview target ends the preview session loudly
  // instead of silently falling back to full admin rights.
  if (!previewUser || !previewUser.isActive) {
    throw forbidden('The preview user no longer exists or is inactive.');
  }

  return {
    id: previewUser.id,
    name: previewUser.name,
    email: previewUser.email,
    role: previewUser.role,
  };
}
