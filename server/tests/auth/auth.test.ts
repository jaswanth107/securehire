import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  as,
  expectAbsent,
  SEED_IDS,
  setupTestContext,
  teardown,
  type TestContext,
} from '../helpers/test-data.js';
import { env } from '../../src/config/env.js';

describe('Authentication', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });
  afterAll(teardown);

  it('issues an HTTP-only cookie on login and never returns the password hash', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'recruiter.a@example.com', password: env.seedPassword });

    expect(response.status).toBe(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('HttpOnly');
    expectAbsent(response.body, ['passwordHash', '$2a$', '$2b$']);
  });

  it('authenticates a browser session from the cookie alone', async () => {
    const agent = request.agent(ctx.app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'recruiter.a@example.com', password: env.seedPassword })
      .expect(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.effectiveUser.id).toBe(SEED_IDS.recruiterA);
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const wrongPassword = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'recruiter.a@example.com', password: 'NotThePassword1!' });
    const unknownEmail = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'NotThePassword1!' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('refuses protected endpoints without a session', async () => {
    for (const url of ['/api/candidates', '/api/requisitions', '/api/users', '/api/auth/me']) {
      const response = await request(ctx.app).get(url);
      expect(response.status).toBe(401);
    }
  });

  it('refuses a forged token signed with the wrong secret', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'not-the-real-secret', {
      subject: SEED_IDS.admin,
      expiresIn: '1h',
    });

    const response = await request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
  });

  it('ignores an inflated role claim inside an otherwise valid token', async () => {
    // Correctly signed, but claims ADMIN for a recruiter. The server re-reads
    // the role from the database, so the claim buys nothing.
    const inflated = jwt.sign({ role: 'ADMIN' }, env.jwtSecret, {
      subject: SEED_IDS.recruiterA,
      expiresIn: '1h',
    });

    const response = await request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${inflated}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);

    const adminOnly = await request(ctx.app)
      .get('/api/users')
      .set('Authorization', `Bearer ${inflated}`);
    expect(adminOnly.status).toBe(403);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ role: 'RECRUITER' }, env.jwtSecret, {
      subject: SEED_IDS.recruiterA,
      expiresIn: '-1s',
    });

    const response = await request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
  });

  it('does not allow self-registration as an administrator', async () => {
    const response = await request(ctx.app).post('/api/auth/register').send({
      name: 'Would Be Admin',
      email: 'wouldbe.admin@example.com',
      password: 'SuperSecret123',
      role: 'ADMIN',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'wouldbe.admin@example.com', password: 'SuperSecret123' });
    expect(login.status).toBe(401);
  });

  it('creates a recruiter through registration with no data visibility', async () => {
    const response = await request(ctx.app).post('/api/auth/register').send({
      name: 'Fresh Recruiter',
      email: 'fresh.recruiter@example.com',
      password: 'SuperSecret123',
      role: 'RECRUITER',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('RECRUITER');
    expectAbsent(response.body, ['passwordHash']);

    // A brand-new recruiter owns nothing, so they see nothing.
    const candidates = await request(ctx.app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${response.body.data.token}`);
    expect(candidates.body.data).toHaveLength(0);
  });

  it('logs out by clearing the session cookie', async () => {
    const agent = request.agent(ctx.app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'panelist.a@example.com', password: env.seedPassword })
      .expect(200);

    await agent.post('/api/auth/logout').expect(200);
    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  it('keeps admin-only user management closed to other roles', async () => {
    expect((await as(ctx, 'recruiterA').get('/api/users')).status).toBe(403);
    expect((await as(ctx, 'panelistA').get('/api/users')).status).toBe(403);
    expect((await as(ctx, 'panelistA').get('/api/users/panelists')).status).toBe(403);
    expect((await as(ctx, 'admin').get('/api/users')).status).toBe(200);
  });
});
