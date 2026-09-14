import type { FastifyInstance } from 'fastify';
import type { DB } from '../../db/index.js';
import { newId } from '../../util/ids.js';
import { nowIso } from '../../util/time.js';
import { Errors } from '../../util/errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSession, revokeAllUserSessions, revokeSession, SESSION_COOKIE } from './session.js';
import { requireAuth } from '../../plugins/auth.js';
import { audit } from '../audit/index.js';
import { rateLimit } from '../../plugins/rateLimit.js';

interface SignupBody { email?: string; password?: string; name?: string }
interface LoginBody { email?: string; password?: string }

export async function authRoutes(app: FastifyInstance, opts: { db: DB; seedAdminEmail?: string }): Promise<void> {
  const { db, seedAdminEmail } = opts;

  app.post<{ Body: SignupBody }>('/api/auth/signup', async (req, reply) => {
    if (!rateLimit('signup', req, 10, 60_000)) throw Errors.tooMany();
    const { email, password, name } = req.body ?? {};
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Errors.badRequest('Valid email required');
    if (!password || password.length < 8) throw Errors.badRequest('Password must be at least 8 characters');
    if (!name || name.trim().length < 1) throw Errors.badRequest('Name required');

    const lower = email.toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(lower);
    if (existing) throw Errors.conflict('Email already registered');

    const userId = newId();
    const orgId = newId();
    const now = nowIso();
    const isPlatformAdmin = seedAdminEmail ? seedAdminEmail.toLowerCase() === lower : false;
    const orgName = `${name.trim()}'s workspace`;
    const passwordHash = await hashPassword(password);

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, is_platform_admin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, lower, name.trim(), passwordHash, isPlatformAdmin ? 1 : 0, now, now);
      db.prepare(
        `INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`
      ).run(orgId, orgName, `ws-${orgId.slice(0, 8)}`, now, now);
      db.prepare(
        `INSERT INTO memberships (id, org_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`
      ).run(newId(), orgId, userId, now);
      db.prepare(
        `INSERT INTO subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, 'free', 'active', ?, ?, ?, ?)`
      ).run(newId(), orgId, now, new Date(Date.now() + 30 * 86_400_000).toISOString(), now, now);
    });
    tx();

    audit(db, { orgId, actorUserId: userId, action: 'auth.signup', targetType: 'user', targetId: userId });
    const { token, expiresAt } = createSession(db, userId);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(expiresAt),
    });
    return { user: { id: userId, email: lower, name: name.trim(), isPlatformAdmin } };
  });

  app.post<{ Body: LoginBody }>('/api/auth/login', async (req, reply) => {
    if (!rateLimit('login', req, 10, 60_000)) throw Errors.tooMany();
    const { email, password } = req.body ?? {};
    if (!email || !password) throw Errors.badRequest('Email and password required');
    const row = db
      .prepare('SELECT id, email, name, password_hash, is_platform_admin, deleted_at FROM users WHERE email = ?')
      .get(email.toLowerCase()) as
      | { id: string; email: string; name: string; password_hash: string; is_platform_admin: number; deleted_at: string | null }
      | undefined;
    const ok = row && !row.deleted_at ? await verifyPassword(password, row.password_hash) : false;
    if (!ok) throw Errors.unauthorized('Invalid email or password');
    const { token, expiresAt } = createSession(db, row!.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(expiresAt),
    });
    return {
      user: { id: row!.id, email: row!.email, name: row!.name, isPlatformAdmin: row!.is_platform_admin === 1 },
    };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.auth.sessionId) revokeSession(db, req.auth.sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => {
    const user = requireAuth(req);
    const org = req.auth.org;
    return {
      user,
      org: org
        ? { id: org.orgId, name: org.orgName, slug: org.orgSlug, status: org.orgStatus, role: org.role }
        : null,
    };
  });

  app.patch<{ Body: { name?: string } }>('/api/auth/me', async (req) => {
    const user = requireAuth(req);
    const { name } = req.body ?? {};
    if (!name || name.trim().length < 1) throw Errors.badRequest('Name required');
    db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), nowIso(), user.id);
    return { ok: true };
  });

  app.patch<{ Body: { currentPassword?: string; newPassword?: string } }>('/api/auth/password', async (req) => {
    const user = requireAuth(req);
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) throw Errors.badRequest('Both passwords required');
    if (newPassword.length < 8) throw Errors.badRequest('New password must be at least 8 characters');
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!(await verifyPassword(currentPassword, row.password_hash))) throw Errors.unauthorized('Current password incorrect');
    const hash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowIso(), user.id);
    revokeAllUserSessions(db, user.id);
    audit(db, { actorUserId: user.id, action: 'auth.password_changed', targetType: 'user', targetId: user.id });
    return { ok: true, sessionsRevoked: true };
  });

  app.delete('/api/auth/me', async (req, reply) => {
    const user = requireAuth(req);
    const org = req.auth.org;
    const now = nowIso();
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, user.id);
      if (org) db.prepare('UPDATE organizations SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, org.orgId);
    });
    tx();
    revokeAllUserSessions(db, user.id);
    audit(db, { orgId: org?.orgId ?? null, actorUserId: user.id, action: 'auth.account_deleted', targetType: 'user', targetId: user.id });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}
