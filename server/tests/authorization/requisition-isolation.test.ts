import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  as,
  expectAbsent,
  REQUISITION_FINGERPRINTS,
  SEED_IDS,
  setupTestContext,
  teardown,
  type TestContext,
} from '../helpers/test-data.js';

/**
 * SECURITY TEST 3 — Requisition enumeration leak.
 *
 * The classic regression this catches: `GET /api/requisitions` quietly turning
 * into `findMany()` with no `where`, which looks fine in the UI (the recruiter
 * only "sees" their own row on the dashboard) but ships the whole table.
 */
describe('Security Test 3 — recruiter cannot enumerate other recruiters\' requisitions', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('GET /api/requisitions returns only the authenticated recruiter\'s requisitions', async () => {
    const response = await as(ctx, 'recruiterA').get('/api/requisitions');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(SEED_IDS.requisitionA);
    expect(response.body.data[0].recruiterId).toBe(SEED_IDS.recruiterA);

    // Requisition B must not appear anywhere in the response — not as a row,
    // not nested inside a count, not in a recruiter summary.
    expectAbsent(response.body, [...REQUISITION_FINGERPRINTS.B]);
  });

  it('denies GET /api/requisitions/:id for another recruiter\'s requisition', async () => {
    const response = await as(ctx, 'recruiterA').get(`/api/requisitions/${SEED_IDS.requisitionB}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expectAbsent(response.body, [...REQUISITION_FINGERPRINTS.B]);
  });

  it('denies PATCH of another recruiter\'s requisition', async () => {
    const response = await as(ctx, 'recruiterA')
      .patch(`/api/requisitions/${SEED_IDS.requisitionB}`)
      .send({ status: 'CLOSED', title: 'Hijacked' });

    expect(response.status).toBe(403);

    const owner = await as(ctx, 'recruiterB').get(`/api/requisitions/${SEED_IDS.requisitionB}`);
    expect(owner.body.data.title).toBe('Platform Security Engineer');
    expect(owner.body.data.status).toBe('OPEN');
  });

  it('ignores a body-supplied recruiterId when a recruiter creates a requisition', async () => {
    // Attempting to plant a requisition under Recruiter B's ownership.
    const response = await as(ctx, 'recruiterA').post('/api/requisitions').send({
      title: 'Planted Requisition',
      department: 'Engineering',
      description: 'Created by A, claiming to belong to B.',
      recruiterId: SEED_IDS.recruiterB,
    });

    expect(response.status).toBe(201);
    // Ownership comes from the session, not the payload.
    expect(response.body.data.recruiterId).toBe(SEED_IDS.recruiterA);

    const victim = await as(ctx, 'recruiterB').get('/api/requisitions');
    const titles = victim.body.data.map((r: { title: string }) => r.title);
    expect(titles).not.toContain('Planted Requisition');
  });

  it('gives panelists no requisition surface at all', async () => {
    const list = await as(ctx, 'panelistA').get('/api/requisitions');
    expect(list.status).toBe(403);
    expectAbsent(list.body, [...REQUISITION_FINGERPRINTS.A, ...REQUISITION_FINGERPRINTS.B]);

    const detail = await as(ctx, 'panelistA').get(`/api/requisitions/${SEED_IDS.requisitionA}`);
    expect(detail.status).toBe(403);
    expectAbsent(detail.body, [...REQUISITION_FINGERPRINTS.A]);
  });

  it('lets the admin see every requisition (the control case)', async () => {
    const response = await as(ctx, 'admin').get('/api/requisitions');
    expect(response.status).toBe(200);
    const ids = response.body.data.map((r: { id: string }) => r.id);
    expect(ids).toEqual(expect.arrayContaining([SEED_IDS.requisitionA, SEED_IDS.requisitionB]));
  });
});
