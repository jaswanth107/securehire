import type { Role } from '@prisma/client';

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      /** The identity proven by the auth cookie/bearer token. Never spoofable. */
      authenticatedUser?: RequestUser;
      /**
       * The identity whose permissions are applied to this request. Equal to
       * `authenticatedUser` unless an ADMIN is previewing as another user.
       */
      effectiveUser?: RequestUser;
      /** Alias of `effectiveUser`, kept for readability in controllers. */
      user?: RequestUser;
      isPreview?: boolean;
    }
  }
}

export {};
