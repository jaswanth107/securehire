import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AUTH_COOKIE, cookieOptions, signToken } from '../lib/jwt.js';
import { conflict, unauthenticated } from '../lib/errors.js';
import { serializeUser } from '../lib/presenters.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const BCRYPT_ROUNDS = 12;

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name: string;
    email: string;
    password: string;
    role: 'RECRUITER' | 'PANELIST';
  };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw conflict('An account with that email already exists.');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // `role` can only be RECRUITER or PANELIST — the request schema rejects ADMIN,
  // so there is no public path to an administrator account.
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
  res.status(201).json({ success: true, data: { user: serializeUser(user), token } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await prisma.user.findUnique({ where: { email } });

  // Compare against a dummy hash when the user is missing so that response
  // timing does not reveal which emails are registered.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || !passwordMatches || !user.isActive) {
    throw unauthenticated('Invalid email or password.');
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
  // The token is also returned for non-browser API clients; browsers should
  // rely on the HTTP-only cookie set above.
  res.json({ success: true, data: { user: serializeUser(user), token } });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true, data: { message: 'Signed out.' } });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const authenticatedUser = req.authenticatedUser!;
  const effectiveUser = req.effectiveUser!;
  res.json({
    success: true,
    data: {
      authenticatedUser,
      effectiveUser,
      isPreview: Boolean(req.isPreview),
    },
  });
});
