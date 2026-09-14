import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, signup } from './helpers.js';

test('auth: signup provisions user + org + free subscription', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'alice@test.dev');
  assert.ok(s.userId);
  assert.ok(s.orgId);
  const sub = db.prepare("SELECT plan_id FROM subscriptions WHERE org_id = ? AND status='active'").get(s.orgId) as { plan_id: string };
  assert.equal(sub.plan_id, 'free');
  const member = db.prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ?").get(s.orgId, s.userId) as { role: string };
  assert.equal(member.role, 'owner');
  const hash = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(s.userId) as { password_hash: string };
  assert.match(hash.password_hash, /^scrypt\$/);
});

test('auth: duplicate email → 409', async () => {
  const { app } = await makeApp();
  await signup(app, 'dup@test.dev');
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'dup@test.dev', password: 'password123', name: 'Dup' } });
  assert.equal(res.statusCode, 409);
});

test('auth: anonymous protected route → 401', async () => {
  const { app } = await makeApp();
  const res = await app.inject({ method: 'GET', url: '/api/links' });
  assert.equal(res.statusCode, 401);
});

test('auth: login wrong password → 401 uniform message', async () => {
  const { app } = await makeApp();
  await signup(app, 'bob@test.dev');
  const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'bob@test.dev', password: 'wrongpass1' } });
  const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ghost@test.dev', password: 'wrongpass1' } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(unknown.statusCode, 401);
  assert.equal(wrong.json().message, unknown.json().message);
});

test('auth: logout revokes session → me 401', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'carol@test.dev');
  await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: s.cookies } });
  const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: s.cookies } });
  assert.equal(res.statusCode, 401);
});

test('auth: password change revokes other sessions', async () => {
  const { app } = await makeApp();
  const s = await signup(app, 'dave@test.dev');
  const res = await app.inject({
    method: 'PATCH', url: '/api/auth/password',
    headers: { cookie: s.cookies },
    payload: { currentPassword: 'password123', newPassword: 'newpassword456' },
  });
  assert.equal(res.statusCode, 200);
  const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: s.cookies } });
  assert.equal(me.statusCode, 401);
  const relogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dave@test.dev', password: 'newpassword456' } });
  assert.equal(relogin.statusCode, 200);
});

test('auth: account delete soft-deletes and revokes', async () => {
  const { app, db } = await makeApp();
  const s = await signup(app, 'erin@test.dev');
  const res = await app.inject({ method: 'DELETE', url: '/api/auth/me', headers: { cookie: s.cookies } });
  assert.equal(res.statusCode, 200);
  const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: s.cookies } });
  assert.equal(me.statusCode, 401);
  const u = db.prepare('SELECT deleted_at FROM users WHERE id = ?').get(s.userId) as { deleted_at: string | null };
  assert.ok(u.deleted_at);
});

test('auth: weak password → 400', async () => {
  const { app } = await makeApp();
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email: 'weak@test.dev', password: 'short', name: 'W' } });
  assert.equal(res.statusCode, 400);
});
