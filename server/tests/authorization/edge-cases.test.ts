import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  as,
  CANDIDATE_FINGERPRINTS,
  expectAbsent,
  REQUISITION_FINGERPRINTS,
  SEED_IDS,
  setupTestContext,
  teardown,
  type TestContext,
} from '../helpers/test-data.js';

/**
 * Authorization has to track the *current* state of the database, not the state
 * that existed when a token was issued. These cover the transitions where a
 * cached decision would quietly become a leak.
 */
describe('Authorization edge cases and state transitions', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('invalidates an existing session as soon as the account is deactivated', async () => {
    expect((await as(ctx, 'recruiterB').get('/api/candidates')).status).toBe(200);

    await as(ctx, 'admin')
      .patch(`/api/users/${SEED_IDS.recruiterB}`)
      .send({ isActive: false })
      .expect(200);

    // Same token, now worthless.
    const afterDeactivation = await as(ctx, 'recruiterB').get('/api/candidates');
    expect(afterDeactivation.status).toBe(401);
    expectAbsent(afterDeactivation.body, [...CANDIDATE_FINGERPRINTS.B1]);

    // Their data does not become public in the process.
    const otherRecruiter = await as(ctx, 'recruiterA').get('/api/candidates');
    expect(otherRecruiter.body.data).toHaveLength(2);
    expectAbsent(otherRecruiter.body, [...CANDIDATE_FINGERPRINTS.B1, ...CANDIDATE_FINGERPRINTS.B2]);

    await as(ctx, 'admin')
      .patch(`/api/users/${SEED_IDS.recruiterB}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('refuses preview as a deactivated user instead of falling back to admin rights', async () => {
    await as(ctx, 'admin')
      .patch(`/api/users/${SEED_IDS.panelistB}`)
      .send({ isActive: false })
      .expect(200);

    const response = await request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .set('X-Preview-As-User', SEED_IDS.panelistB);

    // The important part is that this is *not* a 200 carrying all four
    // candidates because the preview target silently resolved to the admin.
    expect(response.status).toBe(403);
    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.A1,
      ...CANDIDATE_FINGERPRINTS.A2,
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
    ]);

    await as(ctx, 'admin')
      .patch(`/api/users/${SEED_IDS.panelistB}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('moves access with the candidate when an admin changes its requisition', async () => {
    await as(ctx, 'admin')
      .patch(`/api/candidates/${SEED_IDS.candidateA2}`)
      .send({ requisitionId: SEED_IDS.requisitionB })
      .expect(200);

    // The former owner loses the candidate immediately.
    const formerOwner = await as(ctx, 'recruiterA').get(`/api/candidates/${SEED_IDS.candidateA2}`);
    expect(formerOwner.status).toBe(403);
    expectAbsent(formerOwner.body, [...CANDIDATE_FINGERPRINTS.A2]);

    const formerOwnerList = await as(ctx, 'recruiterA').get('/api/candidates');
    expect(formerOwnerList.body.data.map((c: { id: string }) => c.id)).not.toContain(
      SEED_IDS.candidateA2,
    );

    // The new owner gains it.
    const newOwner = await as(ctx, 'recruiterB').get(`/api/candidates/${SEED_IDS.candidateA2}`);
    expect(newOwner.status).toBe(200);

    await as(ctx, 'admin')
      .patch(`/api/candidates/${SEED_IDS.candidateA2}`)
      .send({ requisitionId: SEED_IDS.requisitionA })
      .expect(200);
  });

  it('moves access with the requisition when an admin reassigns the recruiter', async () => {
    await as(ctx, 'admin')
      .patch(`/api/requisitions/${SEED_IDS.requisitionA}`)
      .send({ recruiterId: SEED_IDS.recruiterB })
      .expect(200);

    const formerOwner = await as(ctx, 'recruiterA').get('/api/requisitions');
    expect(formerOwner.body.data).toHaveLength(0);
    expectAbsent(formerOwner.body, [...REQUISITION_FINGERPRINTS.A]);

    const detail = await as(ctx, 'recruiterA').get(`/api/requisitions/${SEED_IDS.requisitionA}`);
    expect(detail.status).toBe(403);

    await as(ctx, 'admin')
      .patch(`/api/requisitions/${SEED_IDS.requisitionA}`)
      .send({ recruiterId: SEED_IDS.recruiterA })
      .expect(200);
  });

  it('stops a recruiter from reassigning requisition ownership to themselves', async () => {
    const response = await as(ctx, 'recruiterA')
      .patch(`/api/requisitions/${SEED_IDS.requisitionB}`)
      .send({ recruiterId: SEED_IDS.recruiterA });

    expect(response.status).toBe(403);

    const owner = await as(ctx, 'recruiterB').get(`/api/requisitions/${SEED_IDS.requisitionB}`);
    expect(owner.body.data.recruiterId).toBe(SEED_IDS.recruiterB);
  });

  it('stops a recruiter deleting a requisition', async () => {
    const response = await as(ctx, 'recruiterA').delete(
      `/api/requisitions/${SEED_IDS.requisitionA}`,
    );
    expect(response.status).toBe(403);

    const stillThere = await as(ctx, 'recruiterA').get(`/api/requisitions/${SEED_IDS.requisitionA}`);
    expect(stillThere.status).toBe(200);
  });

  it('scopes dashboard counts so tiles cannot reveal hidden volume', async () => {
    const adminStats = await as(ctx, 'admin').get('/api/stats/dashboard');
    expect(adminStats.body.data.candidateCount).toBe(4);

    const recruiterStats = await as(ctx, 'recruiterA').get('/api/stats/dashboard');
    expect(recruiterStats.body.data.candidateCount).toBe(2);
    expect(recruiterStats.body.data.requisitionCount).toBe(1);

    const panelistStats = await as(ctx, 'panelistA').get('/api/stats/dashboard');
    expect(panelistStats.body.data.candidateCount).toBe(1);
    expect(panelistStats.body.data.requisitionCount).toBe(0);
  });

  it('rejects malformed payloads before any authorization side effects', async () => {
    const badRating = await as(ctx, 'panelistA')
      .post(`/api/candidates/${SEED_IDS.candidateA1}/feedback`)
      .send({ rating: 99, feedback: 'out of range' });
    expect(badRating.status).toBe(400);

    const badId = await as(ctx, 'recruiterA').get('/api/requisitions/12345');
    expect(badId.status).toBe(400);

    const emptyPatch = await as(ctx, 'recruiterA')
      .patch(`/api/candidates/${SEED_IDS.candidateA1}`)
      .send({});
    expect(emptyPatch.status).toBe(400);
  });

  it('gives the admin the full picture (the control case)', async () => {
    const candidates = await as(ctx, 'admin').get('/api/candidates');
    expect(candidates.body.data).toHaveLength(4);

    const requisitions = await as(ctx, 'admin').get('/api/requisitions');
    expect(requisitions.body.data).toHaveLength(2);

    const users = await as(ctx, 'admin').get('/api/users');
    expect(users.body.data.length).toBeGreaterThanOrEqual(5);
    expectAbsent(users.body, ['passwordHash']);
  });
});
