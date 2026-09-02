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
 * Panel assignment is the mechanism that *grants* access, so the ability to
 * write to it is itself a privilege boundary: a recruiter who could assign a
 * panelist to any candidate could hand out access to another recruiter's data.
 */
describe('Panelist assignment authorization', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('stops a recruiter assigning panelists on another recruiter\'s candidate', async () => {
    const response = await as(ctx, 'recruiterA')
      .post(`/api/candidates/${SEED_IDS.candidateB1}/panelists`)
      .send({ panelistId: SEED_IDS.panelistA });

    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1]);

    // And no access was granted as a side effect.
    const attempt = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateB1}`);
    expect(attempt.status).toBe(403);
  });

  it('stops a recruiter revoking a panelist on another recruiter\'s candidate', async () => {
    const response = await as(ctx, 'recruiterA').delete(
      `/api/candidates/${SEED_IDS.candidateB1}/panelists/${SEED_IDS.panelistB}`,
    );
    expect(response.status).toBe(403);

    // Panelist B still has their legitimate access.
    const stillAssigned = await as(ctx, 'panelistB').get(`/api/candidates/${SEED_IDS.candidateB1}`);
    expect(stillAssigned.status).toBe(200);
  });

  it('stops a panelist assigning themselves to a candidate', async () => {
    const response = await as(ctx, 'panelistA')
      .post(`/api/candidates/${SEED_IDS.candidateA2}/panelists`)
      .send({ panelistId: SEED_IDS.panelistA });

    expect(response.status).toBe(403);

    const attempt = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateA2}`);
    expect(attempt.status).toBe(403);
    expectAbsent(attempt.body, [...CANDIDATE_FINGERPRINTS.A2]);
  });

  it('lets the owning recruiter assign, which immediately grants panelist access', async () => {
    const assign = await as(ctx, 'recruiterA')
      .post(`/api/candidates/${SEED_IDS.candidateA2}/panelists`)
      .send({ panelistId: SEED_IDS.panelistA });
    expect(assign.status).toBe(201);

    // Authorization reflects current database state, not the state at login.
    const view = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateA2}`);
    expect(view.status).toBe(200);
    expect(view.body.data.id).toBe(SEED_IDS.candidateA2);
  });

  it('revokes access the moment the assignment is removed', async () => {
    await as(ctx, 'recruiterA')
      .post(`/api/candidates/${SEED_IDS.candidateA2}/panelists`)
      .send({ panelistId: SEED_IDS.panelistA });

    const remove = await as(ctx, 'recruiterA').delete(
      `/api/candidates/${SEED_IDS.candidateA2}/panelists/${SEED_IDS.panelistA}`,
    );
    expect([200, 201]).toContain(remove.status);

    // Same session, same token — access is re-evaluated per request.
    const afterRevoke = await as(ctx, 'panelistA').get(`/api/candidates/${SEED_IDS.candidateA2}`);
    expect(afterRevoke.status).toBe(403);
    expectAbsent(afterRevoke.body, [...CANDIDATE_FINGERPRINTS.A2]);

    const list = await as(ctx, 'panelistA').get('/api/candidates');
    expect(list.body.data.map((c: { id: string }) => c.id)).not.toContain(SEED_IDS.candidateA2);
  });

  it('rejects a duplicate assignment with a conflict rather than a second row', async () => {
    const first = await as(ctx, 'recruiterB')
      .post(`/api/candidates/${SEED_IDS.candidateB1}/panelists`)
      .send({ panelistId: SEED_IDS.panelistB });
    expect(first.status).toBe(409);

    const panel = await as(ctx, 'recruiterB').get(
      `/api/candidates/${SEED_IDS.candidateB1}/panelists`,
    );
    expect(panel.body.data.filter((p: { id: string }) => p.id === SEED_IDS.panelistB)).toHaveLength(1);
  });

  it('survives concurrent duplicate assignment requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        as(ctx, 'recruiterA')
          .post(`/api/candidates/${SEED_IDS.candidateA1}/panelists`)
          .send({ panelistId: SEED_IDS.panelistB }),
      ),
    );

    // Exactly one may win; the unique constraint absorbs the rest.
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);

    const panel = await as(ctx, 'recruiterA').get(
      `/api/candidates/${SEED_IDS.candidateA1}/panelists`,
    );
    expect(panel.body.data.filter((p: { id: string }) => p.id === SEED_IDS.panelistB)).toHaveLength(1);
  });

  it('refuses to assign a non-panelist as an interviewer', async () => {
    const response = await as(ctx, 'recruiterA')
      .post(`/api/candidates/${SEED_IDS.candidateA1}/panelists`)
      .send({ panelistId: SEED_IDS.recruiterB });

    expect(response.status).toBe(400);

    const panel = await as(ctx, 'recruiterA').get(
      `/api/candidates/${SEED_IDS.candidateA1}/panelists`,
    );
    expect(panel.body.data.map((p: { id: string }) => p.id)).not.toContain(SEED_IDS.recruiterB);
  });

  it('keeps one panelist\'s feedback invisible to the rest of the panel', async () => {
    await as(ctx, 'panelistA')
      .post(`/api/candidates/${SEED_IDS.candidateA1}/feedback`)
      .send({ rating: 5, feedback: 'Private note from Panelist A.' })
      .expect(201);

    // Panelist B was just added to the same candidate by the concurrency test.
    const otherPanelist = await as(ctx, 'panelistB').get(
      `/api/candidates/${SEED_IDS.candidateA1}/feedback`,
    );
    expect(otherPanelist.status).toBe(200);
    expectAbsent(otherPanelist.body, ['Private note from Panelist A.', SEED_IDS.panelistA]);

    // The owning recruiter does see the whole panel's scoring.
    const owner = await as(ctx, 'recruiterA').get(
      `/api/candidates/${SEED_IDS.candidateA1}/feedback`,
    );
    expect(JSON.stringify(owner.body)).toContain('Private note from Panelist A.');
  });
});
