import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serializeUser } from '../lib/presenters.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { isAdmin } from '../services/authorization.service.js';

/** GET /api/users — admin only. Full directory including roles and status. */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.query as { role?: 'ADMIN' | 'RECRUITER' | 'PANELIST' };
  const users = await prisma.user.findMany({
    where: role ? { role } : {},
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: users.map(serializeUser) });
});

/**
 * GET /api/users/panelists
 *
 * Recruiters need the panelist directory to staff interviews, so this is the
 * one user-listing a non-admin may call — and it exposes only active panelists,
 * never recruiters, admins or account status.
 */
export const listPanelists = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'PANELIST') throw forbidden();

  const panelists = await prisma.user.findMany({
    where: { role: 'PANELIST', isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: panelists.map(serializeUser) });
});

/** PATCH /api/users/:id — admin only; used to deactivate or reactivate accounts. */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  if (!isAdmin(actor)) throw forbidden();

  const targetId = req.params.id!;
  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== 'boolean') throw badRequest('isActive (boolean) is required.');

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw notFound('User not found.');
  if (target.id === actor.id) throw badRequest('You cannot change your own account status.');

  const updated = await prisma.user.update({ where: { id: targetId }, data: { isActive } });
  res.json({ success: true, data: serializeUser(updated) });
});

/**
 * GET /api/preview/users — the roster the admin console offers for preview.
 *
 * Gated on the *authenticated* identity so that an admin already previewing as
 * a recruiter can still switch targets or leave preview mode.
 */
export const listPreviewUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: users.map(serializeUser) });
});
