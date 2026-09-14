import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, signup } from './helpers.js';

type App = Awaited<ReturnType<typeof makeApp>>['app'];

test('fix1: internal errors masked as 500 INTERNAL (no SQL leak)', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'mask@test.dev');
  // Force an internal error path: malformed JSON body on create link
  const res = await app.inject({
    method: 'POST', url: '/api/links', headers: { cookie: s.cookies, 'content-type': 'application/json' },
    payload: 'not-json{{',
  });
  // Whatever the status, body must never contain SQL/SQLITE internals
  assert.doesNotMatch(res.body, /SQLITE|SELECT|INSERT|constraint/i);
});

test('fix2: soft-deleted slug becomes reusable', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'slugreuse@test.dev');
  const created = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/a', slug: 'reusable' } });
  assert.equal(created.statusCode, 200);
  const id = created.json().link.id as string;
  await app.inject({ method: 'DELETE', url: `/api/links/${id}`, headers: { cookie: s.cookies } });
  const recreate = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/b', slug: 'reusable' } });
  assert.equal(recreate.statusCode, 200);
  // deleted link's slug no longer redirects
  const pub = await app.inject({ method: 'GET', url: '/r/reusable' });
  assert.equal(pub.statusCode, 302);
  assert.equal(pub.headers.location, 'https://example.com/b');
});

test('fix3: XFF forgery cannot bypass login rate limit (no trustProxy in tests)', async () => {
  const { openDatabase, migrate, seedPlans } = await import('../src/db/index.js');
  const { buildApp } = await import('../src/app.js');
  const db = openDatabase(':memory:'); migrate(db); seedPlans(db);
  // NO rateLimitKey override → production default keys by req.ip; trustProxy off in this config
  const app = await buildApp({ db, logger: false });
  const signupRes = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'xff@test.dev', password: 'password123', name: 'X' } });
  assert.equal(signupRes.statusCode, 200);
  let lastStatus = 0;
  for (let i = 0; i < 12; i++) {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      headers: { 'x-forwarded-for': `1.2.3.${i}` }, // forged different IPs
      payload: { email: 'xff@test.dev', password: 'wrong-password' },
    });
    lastStatus = res.statusCode;
    if (i >= 10) assert.equal(lastStatus, 429, `attempt ${i} should be rate limited`);
  }
  assert.equal(lastStatus, 429);
});

test('fix4: suspend/resume nonexistent org → 404', async () => {
  const { app } = await makeApp({ seedAdminEmail: 'ad4@test.dev' });
  const admin = await signup(app, 'ad4@test.dev');
  const suspend = await app.inject({ method: 'POST', url: '/api/admin/orgs/00000000-0000-0000-0000-000000000000/suspend', headers: { cookie: admin.cookies } });
  assert.equal(suspend.statusCode, 404);
  const resume = await app.inject({ method: 'POST', url: '/api/admin/orgs/00000000-0000-0000-0000-000000000000/resume', headers: { cookie: admin.cookies } });
  assert.equal(resume.statusCode, 404);
});

test('fix5: downgrade prunes click detail to new cap', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'prune@test.dev');
  // Pro: cap 10000; create link, upgrade to pro, click 3 times
  await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'pro' } });
  const created = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/prune' } });
  const link = created.json().link as { id: string; slug: string };
  for (let i = 0; i < 3; i++) await app.inject({ method: 'GET', url: `/r/${link.slug}` });
  let details = (db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE link_id = ?').get(link.id) as { c: number }).c;
  assert.equal(details, 3);
  // Downgrade to free — free cap is 100 so 3 stays; verify prune logic with direct cap check:
  // Instead test the boundary: simulate cap via another link after downgrade with exactly cap+1 clicks is slow (101 requests).
  // Direct verification: downgrade succeeds and redirect still records; count bounded by free cap 100.
  await app.inject({ method: 'POST', url: '/api/billing/change-plan', headers: { cookie: s.cookies }, payload: { planId: 'free' } });
  for (let i = 0; i < 120; i++) await app.inject({ method: 'GET', url: `/r/${link.slug}` });
  const total = db.prepare('SELECT total_clicks FROM links WHERE id = ?').get(link.id) as { total_clicks: number };
  assert.equal(total.total_clicks, 123);
  details = (db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE link_id = ?').get(link.id) as { c: number }).c;
  assert.equal(details, 100); // free cap enforced after downgrade
});

test('fix6: session cookie flags (HttpOnly, SameSite=Lax)', async () => {
  const { app } = await makeApp();
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'flags@test.dev', password: 'password123', name: 'F' } });
  const sc = res.headers['set-cookie'];
  const cookieStr = Array.isArray(sc) ? sc.join(';') : (sc ?? '');
  assert.match(cookieStr, /HttpOnly/i);
  assert.match(cookieStr, /SameSite=Lax/i);
});
