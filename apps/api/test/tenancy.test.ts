import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, signup } from './helpers.js';

type App = Awaited<ReturnType<typeof makeApp>>['app'];

async function createLink(app: App, cookies: string, targetUrl = 'https://example.com/a') {
  const res = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: cookies }, payload: { targetUrl } });
  if (res.statusCode !== 200) throw new Error(`create link failed ${res.statusCode}: ${res.body}`);
  return res.json().link as { id: string; slug: string };
}

test('tenancy: cross-tenant read → 404', async () => {
  const { app } = await makeApp();
  const a = await signup(app, 'orga@test.dev');
  const b = await signup(app, 'orgb@test.dev');
  const linkA = await createLink(app, a.cookies);
  const res = await app.inject({ method: 'GET', url: `/api/links/${linkA.id}`, headers: { cookie: b.cookies } });
  assert.equal(res.statusCode, 404);
});

test('tenancy: cross-tenant delete → 404 (resource intact)', async () => {
  const { app, db } = await makeApp();
  const a = await signup(app, 'ten1@test.dev');
  const b = await signup(app, 'ten2@test.dev');
  const linkA = await createLink(app, a.cookies);
  const res = await app.inject({ method: 'DELETE', url: `/api/links/${linkA.id}`, headers: { cookie: b.cookies } });
  assert.equal(res.statusCode, 404);
  const still = db.prepare('SELECT deleted_at FROM links WHERE id = ?').get(linkA.id) as { deleted_at: string | null };
  assert.equal(still.deleted_at, null);
});

test('tenancy: list shows only own links', async () => {
  const { app } = await makeApp();
  const a = await signup(app, 'list1@test.dev');
  const b = await signup(app, 'list2@test.dev');
  await createLink(app, a.cookies, 'https://example.com/one');
  await createLink(app, a.cookies, 'https://example.com/two');
  await createLink(app, b.cookies, 'https://example.com/three');
  const resA = await app.inject({ method: 'GET', url: '/api/links', headers: { cookie: a.cookies } });
  const resB = await app.inject({ method: 'GET', url: '/api/links', headers: { cookie: b.cookies } });
  assert.equal(resA.json().links.length, 2);
  assert.equal(resB.json().links.length, 1);
});

test('tenancy: cross-tenant clicks read → 404', async () => {
  const { app } = await makeApp();
  const a = await signup(app, 'clk1@test.dev');
  const b = await signup(app, 'clk2@test.dev');
  const linkA = await createLink(app, a.cookies);
  const res = await app.inject({ method: 'GET', url: `/api/links/${linkA.id}/clicks`, headers: { cookie: b.cookies } });
  assert.equal(res.statusCode, 404);
});

test('admin: non-admin → 403 on all admin routes', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'normie@test.dev');
  for (const url of ['/api/admin/metrics', '/api/admin/orgs', '/api/admin/users', '/api/admin/audit']) {
    const res = await app.inject({ method: 'GET', url, headers: { cookie: s.cookies } });
    assert.equal(res.statusCode, 403, url);
  }
});

test('admin: suspend org → member API 403, public slug 410, resume restores', async () => {
  const { app } = await makeApp({ seedAdminEmail: 'admin@test.dev' });
  const admin = await signup(app, 'admin@test.dev');
  const victim = await signup(app, 'victim@test.dev');
  const link = await createLink(app, victim.cookies, 'https://example.com/victim');

  const suspend = await app.inject({ method: 'POST', url: `/api/admin/orgs/${victim.orgId}/suspend`, headers: { cookie: admin.cookies } });
  assert.equal(suspend.statusCode, 200);

  const apiAfter = await app.inject({ method: 'GET', url: '/api/links', headers: { cookie: victim.cookies } });
  assert.equal(apiAfter.statusCode, 403);

  const pub = await app.inject({ method: 'GET', url: `/r/${link.slug}` });
  assert.equal(pub.statusCode, 410);

  const resume = await app.inject({ method: 'POST', url: `/api/admin/orgs/${victim.orgId}/resume`, headers: { cookie: admin.cookies } });
  assert.equal(resume.statusCode, 200);
  const apiBack = await app.inject({ method: 'GET', url: '/api/links', headers: { cookie: victim.cookies } });
  assert.equal(apiBack.statusCode, 200);
});
