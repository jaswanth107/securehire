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
 * SECURITY TEST 5 — Preview mode must not become privilege escalation.
 *
 * "Preview as another role" is the most dangerous feature in the product: it is
 * an impersonation switch. These tests assert (a) non-admins cannot use it at
 * all, (b) an admin using it genuinely *loses* access rather than keeping their
 * own, and (c) the real identity is still known to the server.
 */
describe('Security Test 5 — preview headers cannot escalate privileges', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  const withPreview = (actor: 'admin' | 'recruiterA' | 'recruiterB' | 'panelistA', previewId: string) =>
    request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${ctx.tokens[actor]}`)
      .set('X-Preview-As-User', previewId);

  it('rejects a recruiter who sends X-Preview-As-User for the admin', async () => {
    const response = await withPreview('recruiterA', SEED_IDS.admin);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');

    // Crucially, the request is refused outright — not silently downgraded to a
    // normal recruiter response that might still carry data.
    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
      ...REQUISITION_FINGERPRINTS.B,
    ]);
  });

  it('rejects a recruiter previewing as another recruiter', async () => {
    const response = await withPreview('recruiterA', SEED_IDS.recruiterB);
    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.B1, ...CANDIDATE_FINGERPRINTS.B2]);
  });

  it('rejects a panelist previewing as anyone', async () => {
    const response = await withPreview('panelistA', SEED_IDS.recruiterA);
    expect(response.status).toBe(403);
    expectAbsent(response.body, [...CANDIDATE_FINGERPRINTS.A2]);
  });

  it('denies a non-admin the preview roster endpoint', async () => {
    const response = await as(ctx, 'recruiterA').get('/api/preview/users');
    expect(response.status).toBe(403);
    expectAbsent(response.body, ['admin@example.com', SEED_IDS.admin]);
  });

  it('lets an admin preview, and applies the previewed user\'s real limits', async () => {
    const response = await withPreview('admin', SEED_IDS.recruiterA);

    expect(response.status).toBe(200);
    // While previewing as Recruiter A the admin sees exactly Recruiter A's rows
    // — admin's own unrestricted view is genuinely set aside.
    expect(response.body.data).toHaveLength(2);
    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
    ]);
  });

  it('narrows an admin to a single candidate when previewing as a panelist', async () => {
    const response = await withPreview('admin', SEED_IDS.panelistA);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(SEED_IDS.candidateA1);
    expectAbsent(response.body, [
      ...CANDIDATE_FINGERPRINTS.A2,
      ...CANDIDATE_FINGERPRINTS.B1,
      ...CANDIDATE_FINGERPRINTS.B2,
    ]);
  });

  it('blocks writes during preview that the previewed user could not perform', async () => {
    const response = await request(ctx.app)
      .patch(`/api/candidates/${SEED_IDS.candidateB1}`)
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .set('X-Preview-As-User', SEED_IDS.recruiterA)
      .send({ status: 'REJECTED' });

    expect(response.status).toBe(403);

    const check = await as(ctx, 'admin').get(`/api/candidates/${SEED_IDS.candidateB1}`);
    expect(check.body.data.status).toBe('INTERVIEWING');
  });

  it('keeps the real admin identity separate from the effective one', async () => {
    const response = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .set('X-Preview-As-User', SEED_IDS.panelistA);

    expect(response.status).toBe(200);
    expect(response.body.data.isPreview).toBe(true);
    expect(response.body.data.authenticatedUser.id).toBe(SEED_IDS.admin);
    expect(response.body.data.authenticatedUser.role).toBe('ADMIN');
    expect(response.body.data.effectiveUser.id).toBe(SEED_IDS.panelistA);
    expect(response.body.data.effectiveUser.role).toBe('PANELIST');
  });

  it('never persists a role change to the database during preview', async () => {
    await withPreview('admin', SEED_IDS.panelistA);

    const users = await as(ctx, 'admin').get('/api/users');
    const admin = users.body.data.find((u: { id: string }) => u.id === SEED_IDS.admin);
    expect(admin.role).toBe('ADMIN');

    // And the admin's own session is unaffected once the header is dropped.
    const afterPreview = await as(ctx, 'admin').get('/api/candidates');
    expect(afterPreview.body.data).toHaveLength(4);
  });

  it('refuses a preview target that does not exist', async () => {
    const response = await request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .set('X-Preview-As-User', '00000000-0000-4000-8000-000000000000');

    expect(response.status).toBe(403);
  });
});
