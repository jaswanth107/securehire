import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { seed, SEED_IDS } from '../../prisma/seed.js';
import { env } from '../../src/config/env.js';

export { SEED_IDS };

export const SEED_EMAILS = {
  admin: 'admin@example.com',
  recruiterA: 'recruiter.a@example.com',
  recruiterB: 'recruiter.b@example.com',
  panelistA: 'panelist.a@example.com',
  panelistB: 'panelist.b@example.com',
} as const;

export type Actor = keyof typeof SEED_EMAILS;

export interface TestContext {
  app: Express;
  tokens: Record<Actor, string>;
}

/** Re-seeds the test database and logs every seeded account in. */
export async function setupTestContext(): Promise<TestContext> {
  await seed();
  const app = createApp();

  const entries = await Promise.all(
    (Object.keys(SEED_EMAILS) as Actor[]).map(async (actor) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: SEED_EMAILS[actor], password: env.seedPassword });

      if (response.status !== 200) {
        throw new Error(`Failed to log in seeded actor "${actor}": ${response.status}`);
      }
      return [actor, response.body.data.token as string] as const;
    }),
  );

  return { app, tokens: Object.fromEntries(entries) as Record<Actor, string> };
}

export async function teardown(): Promise<void> {
  await prisma.$disconnect();
}

/** Convenience wrapper: an authenticated request builder for one actor. */
export function as(ctx: TestContext, actor: Actor) {
  const auth = `Bearer ${ctx.tokens[actor]}`;
  return {
    get: (url: string) => request(ctx.app).get(url).set('Authorization', auth),
    post: (url: string) => request(ctx.app).post(url).set('Authorization', auth),
    patch: (url: string) => request(ctx.app).patch(url).set('Authorization', auth),
    delete: (url: string) => request(ctx.app).delete(url).set('Authorization', auth),
  };
}

/**
 * Asserts that none of `needles` appears anywhere in the response body.
 *
 * A status-code assertion alone would still pass if a handler returned 403 and
 * *also* echoed the protected record; this walks the serialized body so a leak
 * anywhere in the payload — nested, in an error detail, in a stack trace —
 * fails the test.
 */
export function expectAbsent(body: unknown, needles: string[]): void {
  const serialized = JSON.stringify(body ?? {});
  for (const needle of needles) {
    if (serialized.includes(needle)) {
      throw new Error(
        `Authorization leak: response contained forbidden value "${needle}".\nBody: ${serialized}`,
      );
    }
  }
}

/** The identifying strings that must never appear in an unauthorized response. */
export const CANDIDATE_FINGERPRINTS = {
  A1: [SEED_IDS.candidateA1, 'Ananya Rao', 'ananya.rao@example.com', '+91 90000 10001'],
  A2: [SEED_IDS.candidateA2, 'Arjun Mehta', 'arjun.mehta@example.com', '+91 90000 10002'],
  B1: [SEED_IDS.candidateB1, 'Brian Osei', 'brian.osei@example.com', '+1 415 555 0101'],
  B2: [SEED_IDS.candidateB2, 'Bianca Costa', 'bianca.costa@example.com', '+55 11 95555 0102'],
} as const;

export const REQUISITION_FINGERPRINTS = {
  A: [SEED_IDS.requisitionA, 'Senior Frontend Engineer'],
  B: [SEED_IDS.requisitionB, 'Platform Security Engineer', 'Owns authorization architecture'],
} as const;

/** Status codes that count as a secure denial under the project's strategy. */
export const DENIED_STATUSES = [403, 404];
