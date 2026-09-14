import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, signup } from './helpers.js';

test('GOLDEN PATH: signup → create link → redirect → click visible → upgrade', async () => {
  const { app } = await makeApp();
  const email = `golden-${Date.now()}@test.dev`;

  // 1. signup
  const s = await signup(app, email);
  assert.ok(s.cookies.includes('shrinkr_session='));

  // 2. empty dashboard
  const empty = await app.inject({ method: 'GET', url: '/api/links', headers: { cookie: s.cookies } });
  assert.equal(empty.statusCode, 200);
  assert.equal(empty.json().links.length, 0);
  assert.equal(empty.json().plan.id, 'free');

  // 3. create link
  const created = await app.inject({
    method: 'POST', url: '/api/links', headers: { cookie: s.cookies },
    payload: { targetUrl: 'https://shrinkr.dev/launch', title: 'Launch page' },
  });
  assert.equal(created.statusCode, 200);
  const link = created.json().link as { id: string; slug: string; total_clicks: number };

  // 4. public redirect
  const redirect = await app.inject({ method: 'GET', url: `/r/${link.slug}` });
  assert.equal(redirect.statusCode, 302);
  assert.equal(redirect.headers.location, 'https://shrinkr.dev/launch');

  // 5. click visible
  const detail = await app.inject({ method: 'GET', url: `/api/links/${link.id}`, headers: { cookie: s.cookies } });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().link.total_clicks, 1);
  const clicks = await app.inject({ method: 'GET', url: `/api/links/${link.id}/clicks`, headers: { cookie: s.cookies } });
  assert.equal(clicks.json().clicks.length, 1);

  // 6. plan upgrade (sandbox) and usage endpoint
  const up = await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'pro' } });
  assert.equal(up.statusCode, 200);
  const sub = await app.inject({ method: 'GET', url: '/api/billing/subscription', headers: { cookie: s.cookies } });
  assert.equal(sub.json().subscription.plan_id, 'pro');
  assert.equal(sub.json().usage.links, 1);
});
