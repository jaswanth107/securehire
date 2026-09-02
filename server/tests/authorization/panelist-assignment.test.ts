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
 * SECURITY TEST 2 — Panelist assignment leak.
 *
 * Panelist A is assigned to Candidate A1 and nothing else. Everything else in
 * the system — including Candidate A2, which shares a requisition with A1 —
 * must be invisible to them.
 *
 * This suite fails if the panelist branch of `candidateScopeWhere` is replaced
 * with an unfiltered query, or if visibility is derived from the requisition
 * instead of the explicit assignment table.
 */
describe('Security Test 2 — panelist sees only explicitly assigned candidates', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('GET /api/candidates returns the assigned candidate and nothing else', async () => {
    const response = await as(ctx, 'panelistA').get('/api/candidates');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(SEED_IDS.candidateA1);

    // Same-requisition sibling, and both of the other recruiter's candidates.
    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.A2,
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
    ]);
  });

  it('denies GET /api/candidates/:id for another panelist\'s candidate', async () => {
    const response = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateB1}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1]);
  });

  it('denies GET /api/candidates/:id for an unassigned candidate in the same requisition', async () => {
    // A2 shares Requisition A with the candidate this panelist *is* assigned to.
    // Requisition membership must not be enough.
    const response = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateA2}`);

    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.A2]);
  });

  it('allows the assigned candidate but withholds contact details and recruiter notes', async () => {
    const response = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateA1}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(SEED_IDS.candidateA1);
    expect(response.body.data.name).toBe('Ananya Rao');

    // Limited detail: a panelist scores interviews, they do not get the PII.
    expect(response.body.data.email).toBeUndefined();
    expect(response.body.data.phone).toBeUndefined();
    expect(response.body.data.notes).toBeUndefined();
    expectAbsent(response.body, ['ananya.rao@example.com', '+91 90000 10001']);
  });

  it('refuses every panelist write path against an assigned candidate', async () => {
    const create = await as(ctx, 'panelistA').post('/api/candidates').send({
      name: 'Panelist Made This',
      email: 'nope@example.com',
      phone: '+1 555 111 2222',
      requisitionId: SEED_IDS.requisitionA,
    });
    expect(create.status).toBe(403);

    const update = await as(ctx, 'panelistA')
      .patch(`/api/candidates/${SEED_IDS.candidateA1}`)
      .send({ status: 'HIRED' });
    expect(update.status).toBe(403);

    const remove = await as(ctx, 'panelistA').delete(`/api/candidates/${SEED_IDS.candidateA1}`);
    expect(remove.status).toBe(403);

    // The candidate is untouched and still exists.
    const check = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateA1}`);
    expect(check.status).toBe(200);
    expect(check.body.data.status).toBe('INTERVIEWING');
  });

  it('blocks feedback on a candidate the panelist is not assigned to', async () => {
    const response = await as(ctx, 'panelistA')
      .post(`/api/candidates/${SEED_IDS.candidateB1}/feedback`)
      .send({ rating: 1, feedback: 'Should never be stored.' });

    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1]);

    // Recruiter B, who legitimately reads that candidate's panel feedback,
    // sees nothing from the attacker.
    const owner = await as(ctx, 'recruiterB').get(
      `/api/candidates/${SEED_IDS.candidateB1}/feedback`,
    );
    expect(owner.status).toBe(200);
    expect(owner.body.data).toHaveLength(0);
  });

  it('allows feedback on the assigned candidate only', async () => {
    const response = await as(ctx, 'panelistA')
      .post(`/api/candidates/${SEED_IDS.candidateA1}/feedback`)
      .send({ rating: 4, feedback: 'Strong systems design, clear communicator.' });

    expect(response.status).toBe(201);
    expect(response.body.data.panelist.id).toBe(SEED_IDS.panelistA);
  });

  it('does not let a panelist enumerate the rest of the interview panel', async () => {
    const response = await as(ctx, 'panelistA').get(
      `/api/candidates/${SEED_IDS.candidateA1}/panelists`,
    );
    expect(response.status).toBe(403);
  });
});
