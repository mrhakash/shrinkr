import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, signup } from './helpers.js';

type App = Awaited<ReturnType<typeof makeApp>>['app'];

test('quota: 6th link on Free → 402, count stays 5', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'quota@test.dev');
  for (let i = 0; i < 5; i++) {
    const res = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: `https://example.com/q${i}` } });
    assert.equal(res.statusCode, 200, `link ${i}`);
  }
  const sixth = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/q5' } });
  assert.equal(sixth.statusCode, 402);
  const count = (db.prepare('SELECT COUNT(*) AS c FROM links WHERE org_id = ? AND deleted_at IS NULL').get(s.orgId) as { c: number }).c;
  assert.equal(count, 5);
});

test('billing: upgrade Free→Pro raises limit to 100 (sandbox)', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'upgrade@test.dev');
  const change = await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'pro' } });
  assert.equal(change.statusCode, 200);
  assert.equal(change.json().mode, 'sandbox');
  for (let i = 0; i < 8; i++) {
    const res = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: `https://example.com/p${i}` } });
    assert.equal(res.statusCode, 200, `link ${i}`);
  }
  const sub = await app.inject({ method: 'GET', url: '/api/billing/subscription', headers: { cookie: s.cookies } });
  assert.equal(sub.json().subscription.plan_id, 'pro');
  assert.equal(sub.json().usage.maxLinks, 100);
});

test('billing: downgrade below usage → 409', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'downgrade@test.dev');
  await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'pro' } });
  for (let i = 0; i < 6; i++) {
    await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: `https://example.com/d${i}` } });
  }
  const res = await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'free' } });
  assert.equal(res.statusCode, 409);
});

test('billing: audit event written for plan change', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'auditbill@test.dev');
  await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'team' } });
  const ev = db.prepare("SELECT action FROM audit_events WHERE org_id = ? AND action = 'billing.plan_changed'").get(s.orgId);
  assert.ok(ev);
});

test('billing: unknown plan → 400', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'badplan@test.dev');
  const res = await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'enterprise' } });
  assert.equal(res.statusCode, 400);
});
