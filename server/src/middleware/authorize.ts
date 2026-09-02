import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthenticated } from '../lib/errors.js';

/** Route-level role gate. Resource-level checks still run in the controllers. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.effectiveUser;
    if (!user) return next(unauthenticated());
    if (!roles.includes(user.role)) return next(forbidden());
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');

/**
 * Admin-only gate keyed to the *authenticated* identity rather than the
 * effective one. Used by the preview endpoints themselves: an admin previewing
 * as a recruiter must still be able to leave preview mode.
 */
export function requireAuthenticatedAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.authenticatedUser) return next(unauthenticated());
  if (req.authenticatedUser.role !== 'ADMIN') return next(forbidden());
  next();
}
