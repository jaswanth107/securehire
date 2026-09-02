import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  as,
  CANDIDATE_FINGERPRINTS,
  expectAbsent,
  SEED_IDS,
  setupTestContext,
  teardown,
  type TestContext,
} from '../helpers/test-data.js';

/**
 * SECURITY TEST 4 — ID manipulation.
 *
 * The attacker does nothing exotic: they load a page they are entitled to, then
 * edit the id in the URL. Proving the same route answers differently for two
 * ids shows authorization is evaluated against the *resource*, not the route.
 */
describe('Security Test 4 — swapping the id in the URL does not bypass authorization', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('same route, same session: own id succeeds, swapped id is denied', async () => {
    const legitimate = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateA1}`);
    expect(legitimate.status).toBe(200);
    expect(legitimate.body.data.id).toBe(SEED_IDS.candidateA1);

    const tampered = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateB1}`);
    expect(tampered.status).toBe(403);
    expectAbsent(tampered.body, [...CANDIDATE_FINGERPRINTS.B1]);
  });

  it('applies the same rule on nested resources reached by id swapping', async () => {
    const panelists = await as(ctx, 'recruiterA').get(
      `/api/candidates/${SEED_IDS.candidateB1}/panelists`,
    );
    expect(panelists.status).toBe(403);
    expectAbsent(panelists.body, [SEED_IDS.panelistB, 'panelist.b@example.com']);

    const feedback = await as(ctx, 'recruiterA').get(
      `/api/candidates/${SEED_IDS.candidateB1}/feedback`,
    );
    expect(feedback.status).toBe(403);
  });

  it('cannot be bypassed by adding a query parameter that names another owner', async () => {
    // A hand-rolled `?recruiterId=` must not be consulted at all.
    const response = await as(ctx, 'recruiterA').get(
      `/api/candidates?requisitionId=${SEED_IDS.requisitionB}`,
    );

    expect(response.status).toBe(200);
    // The filter narrows within the recruiter's own scope, so the intersection
    // is empty rather than "everything in Requisition B".
    expect(response.body.data).toHaveLength(0);
    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
    ]);
  });

  it('cannot be bypassed by claiming another identity in the request body', async () => {
    const response = await as(ctx, 'recruiterA')
      .post('/api/candidates')
      .send({
        name: 'Body Spoof',
        email: 'spoof@example.com',
        phone: '+1 555 999 8888',
        requisitionId: SEED_IDS.requisitionB,
        // None of these are read by the server.
        userId: SEED_IDS.recruiterB,
        recruiterId: SEED_IDS.recruiterB,
        role: 'ADMIN',
      });

    expect(response.status).toBe(403);

    const victim = await as(ctx, 'recruiterB').get('/api/candidates');
    expect(victim.body.data).toHaveLength(2);
    expect(victim.body.data.map((c: { name: string }) => c.name)).not.toContain('Body Spoof');
  });

  it('returns the same denial for a well-formed id that does not exist', async () => {
    // Identical shape to the cross-tenant denial, so responses cannot be used
    // to distinguish "exists elsewhere" from "does not exist".
    const missing = await as(ctx, 'recruiterA').get(
      '/api/candidates/00000000-0000-4000-8000-000000000000',
    );
    const forbidden = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateB1}`);

    expect(missing.status).toBe(forbidden.status);
    expect(missing.body.error.code).toBe(forbidden.body.error.code);
    expect(missing.body.error.message).toBe(forbidden.body.error.message);
  });

  it('rejects a malformed id without touching the database', async () => {
    const response = await as(ctx, 'recruiterA').get('/api/candidates/not-a-uuid');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
