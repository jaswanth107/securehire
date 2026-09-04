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
 * SECURITY TEST 8 — the activity feed must not become the leak.
 *
 * The feed is the only endpoint that reads across every table in the system,
 * which makes it the highest-value target in the app: one missing filter there
 * discloses more than a missing filter anywhere else.
 *
 * This suite fails if anyone widens `activityScopeWhere`, drops the panelist
 * allow-list, or lets `serializeActivityEvent` return the full row to a
 * panelist.
 */

interface FeedGroup {
  action: string;
  count: number;
  events: {
    id: string;
    candidateName: string | null;
    actor: { id: string; name: string } | null;
    onBehalfOf?: { id: string; name: string } | null;
    targetUser: { id: string; name: string } | null;
    detail: unknown;
  }[];
}

const flatten = (body: { data: { groups: FeedGroup[] } }) =>
  body.data.groups.flatMap((group) => group.events);

describe('Security Test 8 — activity feed scoping', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('keeps one recruiter\'s events out of the other recruiter\'s feed', async () => {
    const created = await as(ctx, 'recruiterB')
      .post('/api/candidates')
      .send({
        name: 'Zola Feedcheck',
        email: 'zola.feedcheck@example.com',
        phone: '+27 11 555 0199',
        requisitionId: SEED_IDS.requisitionB,
      });
    expect(created.status).toBe(201);

    const owner = await as(ctx, 'recruiterB').get('/api/activity');
    expect(owner.status).toBe(200);
    expect(flatten(owner.body).some((e) => e.candidateName === 'Zola Feedcheck')).toBe(true);

    const other = await as(ctx, 'recruiterA').get('/api/activity');
    expect(other.status).toBe(200);
    expectAbsent(other.body, [
      'Zola Feedcheck',
      'zola.feedcheck@example.com',
      'Platform Security Engineer',
      SEED_IDS.requisitionB,
      ...CANDIDATE_FINGERPRINTS.B1,
    ]);
  });

  it('never puts contact details into the log, even for the owner', async () => {
    const owner = await as(ctx, 'recruiterB').get('/api/activity');
    // The candidate name is the deliberate exception — email and phone are not
    // copied into the event at write time at all.
    expectAbsent(owner.body, ['zola.feedcheck@example.com', '+27 11 555 0199']);
  });

  it('shows a panelist only their own actions and things done to them', async () => {
    // Both panelists end up on candidate A2, so the only thing separating what
    // they each see is the scope filter.
    for (const panelist of [SEED_IDS.panelistA, SEED_IDS.panelistB]) {
      const assigned = await as(ctx, 'recruiterA')
        .post(`/api/candidates/${SEED_IDS.candidateA2}/panelists`)
        .send({ panelistId: panelist });
      expect(assigned.status).toBe(201);
    }

    const feed = await as(ctx, 'panelistA').get('/api/activity');
    expect(feed.status).toBe(200);

    const assignments = feed.body.data.groups
      .filter((g: FeedGroup) => g.action === 'PANELIST_ASSIGNED')
      .flatMap((g: FeedGroup) => g.events);

    // Their own assignment is there...
    expect(assignments.length).toBeGreaterThan(0);
    for (const event of assignments) {
      expect(event.targetUser?.id).toBe(SEED_IDS.panelistA);
    }

    // ...and Panelist Priya's assignment to the same candidate is not.
    expectAbsent(feed.body, [SEED_IDS.panelistB, 'Panelist Priya']);
  });

  it('hides another panelist\'s feedback from the panel', async () => {
    const submitted = await as(ctx, 'panelistB')
      .post(`/api/candidates/${SEED_IDS.candidateA2}/feedback`)
      .send({ rating: 2, feedback: 'Struggled on the distributed systems round.' });
    expect(submitted.status).toBe(201);

    const feed = await as(ctx, 'panelistA').get('/api/activity');
    expect(feed.status).toBe(200);
    expectAbsent(feed.body, [
      'Panelist Priya',
      SEED_IDS.panelistB,
      'Struggled on the distributed systems round.',
    ]);

    // The recruiter who owns the pipeline does see that it was filed.
    const recruiterFeed = await as(ctx, 'recruiterA').get('/api/activity');
    expect(
      flatten(recruiterFeed.body).some((e) => e.targetUser?.id === SEED_IDS.panelistB),
    ).toBe(true);
    // But the written feedback is not duplicated into the log for anyone.
    expectAbsent(recruiterFeed.body, ['Struggled on the distributed systems round.']);
  });

  it('anonymises pipeline movement for panelists so no recruiter is named', async () => {
    const moved = await as(ctx, 'recruiterA')
      .patch(`/api/candidates/${SEED_IDS.candidateA1}`)
      .send({ status: 'OFFER' });
    expect(moved.status).toBe(200);

    const feed = await as(ctx, 'panelistA').get('/api/activity');
    const statusEvents = feed.body.data.groups
      .filter((g: FeedGroup) => g.action === 'CANDIDATE_STATUS_CHANGED')
      .flatMap((g: FeedGroup) => g.events);

    expect(statusEvents.length).toBeGreaterThan(0);
    // Panelists have no user directory anywhere in the app; the feed must not
    // become one.
    for (const event of statusEvents) expect(event.actor).toBeNull();
    expectAbsent(feed.body, ['Recruiter Alice', SEED_IDS.recruiterA, SEED_IDS.requisitionA]);
  });

  it('records the authenticated admin, not the previewed recruiter', async () => {
    const created = await as(ctx, 'admin')
      .post('/api/candidates')
      .set('X-Preview-As-User', SEED_IDS.recruiterA)
      .send({
        name: 'Previewed Hire',
        email: 'previewed.hire@example.com',
        phone: '+91 90000 20001',
        requisitionId: SEED_IDS.requisitionA,
      });
    expect(created.status).toBe(201);

    const feed = await as(ctx, 'admin').get('/api/activity');
    const event = flatten(feed.body).find((e) => e.candidateName === 'Previewed Hire');

    expect(event).toBeDefined();
    // The whole point of the split: the admin owns the action, the recruiter is
    // only the identity it was performed under.
    expect(event!.actor?.id).toBe(SEED_IDS.admin);
    expect(event!.onBehalfOf?.id).toBe(SEED_IDS.recruiterA);
  });

  it('survives the cascade that deletes what it describes', async () => {
    const created = await as(ctx, 'recruiterA')
      .post('/api/candidates')
      .send({
        name: 'Doomed Applicant',
        email: 'doomed.applicant@example.com',
        phone: '+91 90000 20002',
        requisitionId: SEED_IDS.requisitionA,
      });
    expect(created.status).toBe(201);

    const removed = await as(ctx, 'recruiterA').delete(`/api/candidates/${created.body.data.id}`);
    expect(removed.status).toBe(200);

    const feed = await as(ctx, 'admin').get('/api/activity?action=CANDIDATE_DELETED');
    expect(
      flatten(feed.body).some((e) => e.candidateName === 'Doomed Applicant'),
    ).toBe(true);
  });

  it('collapses a burst of additions into one group', async () => {
    for (const name of ['Burst One', 'Burst Two', 'Burst Three']) {
      const response = await as(ctx, 'recruiterB')
        .post('/api/candidates')
        .send({
          name,
          email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
          phone: '+27 11 555 0200',
          requisitionId: SEED_IDS.requisitionB,
        });
      expect(response.status).toBe(201);
    }

    const feed = await as(ctx, 'recruiterB').get('/api/activity?action=CANDIDATE_CREATED');
    const newest = feed.body.data.groups[0] as FeedGroup;

    // Four, not three: the addition made earlier in this file is the same
    // recruiter adding to the same requisition inside the window, so it folds
    // into the burst too. That is the behaviour — the grouping is about who
    // did what where, not about how the client chose to batch its requests.
    expect(newest.count).toBe(4);
    expect(newest.events.map((e) => e.candidateName)).toEqual([
      'Burst Three',
      'Burst Two',
      'Burst One',
      'Zola Feedcheck',
    ]);
  });

  it('refuses a cursor belonging to another tenant without confirming it exists', async () => {
    const theirs = await as(ctx, 'recruiterB').get('/api/activity');
    const foreignId = flatten(theirs.body)[0]!.id;

    const stolen = await as(ctx, 'recruiterA').get(`/api/activity?cursor=${foreignId}`);
    const invented = await as(ctx, 'recruiterA').get(
      '/api/activity?cursor=00000000-0000-4000-8000-000000000000',
    );

    // Identical answers, so the cursor cannot be used to probe for event ids.
    expect(stolen.status).toBe(400);
    expect(invented.status).toBe(400);
    expect(stolen.body.error.message).toBe(invented.body.error.message);
    expectAbsent(stolen.body, ['Zola Feedcheck', 'Burst One']);
  });

  it('counts unread over the same scope and ignores your own actions', async () => {
    await as(ctx, 'recruiterA').post('/api/activity/read').send({});

    const quiet = await as(ctx, 'recruiterA').get('/api/activity/unread');
    expect(quiet.body.data.count).toBe(0);

    // Recruiter A acts: their own action must not notify them.
    await as(ctx, 'recruiterA')
      .patch(`/api/candidates/${SEED_IDS.candidateA1}`)
      .send({ status: 'HIRED' });
    const own = await as(ctx, 'recruiterA').get('/api/activity/unread');
    expect(own.body.data.count).toBe(0);

    // Recruiter B acts inside their own tenancy: still nothing for A.
    await as(ctx, 'recruiterB')
      .patch(`/api/candidates/${SEED_IDS.candidateB1}`)
      .send({ status: 'REJECTED' });
    const foreign = await as(ctx, 'recruiterA').get('/api/activity/unread');
    expect(foreign.body.data.count).toBe(0);

    // The admin acting inside A's tenancy is exactly what A should be told.
    await as(ctx, 'admin')
      .patch(`/api/candidates/${SEED_IDS.candidateA2}`)
      .send({ status: 'REJECTED' });
    const notified = await as(ctx, 'recruiterA').get('/api/activity/unread');
    expect(notified.body.data.count).toBeGreaterThan(0);
  });

  it('does not clear the previewed user\'s badge while an admin looks around', async () => {
    const before = await as(ctx, 'recruiterA').get('/api/activity/unread');
    expect(before.body.data.count).toBeGreaterThan(0);

    const marked = await as(ctx, 'admin')
      .post('/api/activity/read')
      .set('X-Preview-As-User', SEED_IDS.recruiterA)
      .send({});
    expect(marked.status).toBe(200);
    expect(marked.body.data.appliedInPreview).toBe(false);

    const after = await as(ctx, 'recruiterA').get('/api/activity/unread');
    expect(after.body.data.count).toBe(before.body.data.count);
  });

  it('requires authentication', async () => {
    const anonymous = await as(ctx, 'recruiterA').get('/api/activity');
    expect(anonymous.status).toBe(200);

    const { app } = ctx;
    const { default: request } = await import('supertest');
    const noSession = await request(app).get('/api/activity');
    expect(noSession.status).toBe(401);
  });
});
