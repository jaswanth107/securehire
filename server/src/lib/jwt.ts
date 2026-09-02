import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  sub: string;
  /**
   * The role is carried for convenience only. Every request re-reads the user
   * from the database, so a stale or tampered role in the token is never the
   * basis of an authorization decision.
   */
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign({ role: payload.role }, env.jwtSecret, {
    subject: payload.sub,
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === 'string' || !decoded.sub) return null;
    return { sub: String(decoded.sub), role: String((decoded as jwt.JwtPayload).role ?? '') };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = 'securehire_token';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.cookieSecure,
  path: '/',
  maxAge: 1000 * 60 * 60 * 2,
};
