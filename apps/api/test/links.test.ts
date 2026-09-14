import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, signup } from './helpers.js';

type App = Awaited<ReturnType<typeof makeApp>>['app'];

test('links: javascript: scheme rejected 400', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'evil@test.dev');
  const res = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'javascript:alert(1)' } });
  assert.equal(res.statusCode, 400);
});

test('links: data: scheme rejected 400', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'evil2@test.dev');
  const res = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'data:text/html,hi' } });
  assert.equal(res.statusCode, 400);
});

test('links: custom slug honored; duplicate slug → 409 (cross-org too)', async () => {
  const { app } = await makeApp();
  const a = await signup(app, 'slug1@test.dev');
  const b = await signup(app, 'slug2@test.dev');
  const first = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: a.cookies }, payload: { targetUrl: 'https://example.com/x', slug: 'my-slug' } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().link.slug, 'my-slug');
  const dup = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: b.cookies }, payload: { targetUrl: 'https://example.com/y', slug: 'my-slug' } });
  assert.equal(dup.statusCode, 409);
});

test('links: invalid custom slug → 400', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'slug3@test.dev');
  const res = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/z', slug: 'bad slug!' } });
  assert.equal(res.statusCode, 400);
});

test('links: redirect 302 to target, click recorded', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'redir@test.dev');
  const created = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/target' } });
  const slug = created.json().link.slug as string;
  const res = await app.inject({ method: 'GET', url: `/r/${slug}` });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, 'https://example.com/target');
  const row = db.prepare('SELECT total_clicks FROM links WHERE slug = ?').get(slug) as { total_clicks: number };
  assert.equal(row.total_clicks, 1);
  const clicks = (db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE link_id = (SELECT id FROM links WHERE slug = ?)').get(slug) as { c: number }).c;
  assert.equal(clicks, 1);
});

test('links: unknown slug → 404', async () => {
  const { app } = await makeApp();
  const res = await app.inject({ method: 'GET', url: '/r/nonexistent' });
  assert.equal(res.statusCode, 404);
});

test('links: click detail capped per plan (free=100), total authoritative', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'cap@test.dev');
  const created = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/cap' } });
  const link = created.json().link as { id: string; slug: string };
  for (let i = 0; i < 102; i++) {
    await app.inject({ method: 'GET', url: `/r/${link.slug}` });
  }
  const total = db.prepare('SELECT total_clicks FROM links WHERE id = ?').get(link.id) as { total_clicks: number };
  assert.equal(total.total_clicks, 102);
  const details = (db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE link_id = ?').get(link.id) as { c: number }).c;
  assert.equal(details, 100);
});

test('links: delete own link → 200; gone from list', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'del@test.dev');
  const created = await app.inject({ method: 'POST', url: '/api/links', headers: { cookie: s.cookies }, payload: { targetUrl: 'https://example.com/del' } });
  const id = created.json().link.id as string;
  const del = await app.inject({ method: 'DELETE', url: `/api/links/${id}`, headers: { cookie: s.cookies } });
  assert.equal(del.statusCode, 200);
  const list = await app.inject({ method: 'GET', url: '/api/links', headers: { cookie: s.cookies } });
  assert.equal(list.json().links.length, 0);
});

test('unit: slug generation + safety', async () => {
  const { generateUniqueSlug, isSafeTarget, isValidCustomSlug } = await import('../src/modules/links/slug.js');
  const taken = new Set(['aaaaaa']);
  const slug = generateUniqueSlug((s) => taken.has(s));
  assert.match(slug, /^[a-zA-Z0-9]{6}$/);
  assert.equal(isSafeTarget('ftp://x'), false);
  assert.equal(isSafeTarget('https://ok.dev'), true);
  assert.equal(isValidCustomSlug('ab'), false);
  assert.equal(isValidCustomSlug('abc'), true);
});
