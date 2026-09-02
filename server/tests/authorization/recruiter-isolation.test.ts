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
 * SECURITY TEST 1 — Recruiter cross-tenant data leak.
 *
 * Attack: Recruiter A holds a valid session and asks for Candidate B1, which
 * lives in Recruiter B's requisition.
 *
 * This suite fails if anyone removes the `requisition.recruiterId` ownership
 * check from `authorizeCandidateAccess`, or the recruiter branch of
 * `candidateScopeWhere`.
 */
describe('Security Test 1 — recruiter cannot read another recruiter\'s candidates', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('denies GET /api/candidates/:id for a candidate in another recruiter\'s requisition', async () => {
    const response = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateB1}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');

    // The denial must not be accompanied by the record itself.
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1]);
  });

  it('returns only own-requisition candidates from GET /api/candidates', async () => {
    const response = await as(ctx, 'recruiterA').get('/api/candidates');

    expect(response.status).toBe(200);
    const ids = response.body.data.map((c: { id: string }) => c.id);

    expect(ids).toContain(SEED_IDS.candidateA1);
    expect(ids).toContain(SEED_IDS.candidateA2);
    expect(ids).toHaveLength(2);

    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
    ]);
  });

  it('denies PATCH of another recruiter\'s candidate and leaves the record untouched', async () => {
    const response = await as(ctx, 'recruiterA')
      .patch(`/api/candidates/${SEED_IDS.candidateB1}`)
      .send({ status: 'REJECTED', name: 'Tampered Name' });

    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1]);

    // Recruiter B still sees the original values: the write never landed.
    const owner = await as(ctx, 'recruiterB').get(`/api/candidates/${SEED_IDS.candidateB1}`);
    expect(owner.status).toBe(200);
    expect(owner.body.data.name).toBe('Brian Osei');
    expect(owner.body.data.status).toBe('INTERVIEWING');
  });

  it('denies DELETE of another recruiter\'s candidate and the record survives', async () => {
    const response = await as(ctx, 'recruiterA').delete(`/api/candidates/${SEED_IDS.candidateB1}`);

    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1]);

    const owner = await as(ctx, 'recruiterB').get(`/api/candidates/${SEED_IDS.candidateB1}`);
    expect(owner.status).toBe(200);
  });

  it('rejects creating a candidate inside another recruiter\'s requisition', async () => {
    const response = await as(ctx, 'recruiterA').post('/api/candidates').send({
      name: 'Planted Candidate',
      email: 'planted@example.com',
      phone: '+1 555 000 0000',
      requisitionId: SEED_IDS.requisitionB,
    });

    expect(response.status).toBe(403);

    // And Recruiter B's pipeline is unchanged.
    const owner = await as(ctx, 'recruiterB').get('/api/candidates');
    const names = owner.body.data.map((c: { name: string }) => c.name);
    expect(names).not.toContain('Planted Candidate');
    expect(owner.body.data).toHaveLength(2);
  });

  it('rejects a forged requisitionId that would move a candidate into another tenancy', async () => {
    const response = await as(ctx, 'recruiterA')
      .patch(`/api/candidates/${SEED_IDS.candidateA1}`)
      .send({ requisitionId: SEED_IDS.requisitionB });

    expect(response.status).toBe(403);

    // Candidate A1 is still in Requisition A, still visible to its owner only.
    const check = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateA1}`);
    expect(check.body.data.requisitionId).toBe(SEED_IDS.requisitionA);
  });
});
