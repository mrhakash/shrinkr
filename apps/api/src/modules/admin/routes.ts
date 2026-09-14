import type { FastifyInstance } from 'fastify';
import type { DB } from '../../db/index.js';
import { nowIso } from '../../util/time.js';
import { Errors } from '../../util/errors.js';
import { requirePlatformAdmin } from '../../plugins/auth.js';
import { audit } from '../audit/index.js';

export async function adminRoutes(app: FastifyInstance, opts: { db: DB }): Promise<void> {
  const { db } = opts;

  app.get('/api/admin/metrics', async (req) => {
    requirePlatformAdmin(req);
    const one = (sql: string): number => (db.prepare(sql).get() as { c: number }).c;
    return {
      orgs: one('SELECT COUNT(*) AS c FROM organizations WHERE deleted_at IS NULL'),
      users: one('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL'),
      links: one('SELECT COUNT(*) AS c FROM links WHERE deleted_at IS NULL'),
      clicks: one('SELECT COALESCE(SUM(total_clicks),0) AS c FROM links'),
    };
  });

  app.get('/api/admin/orgs', async (req) => {
    requirePlatformAdmin(req);
    const rows = db
      .prepare(
        `SELECT o.id, o.name, o.slug, o.status, o.created_at,
                (SELECT plan_id FROM subscriptions s WHERE s.org_id = o.id AND s.status='active') AS plan_id,
                (SELECT COUNT(*) FROM links l WHERE l.org_id = o.id AND l.deleted_at IS NULL) AS link_count
         FROM organizations o WHERE o.deleted_at IS NULL ORDER BY o.created_at DESC`
      )
      .all();
    return { orgs: rows };
  });

  app.post<{ Params: { id: string } }>('/api/admin/orgs/:id/suspend', async (req) => {
    const admin = requirePlatformAdmin(req);
    db.prepare("UPDATE organizations SET status = 'suspended', updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(nowIso(), req.params.id);
    audit(db, { orgId: req.params.id, actorUserId: admin.id, action: 'org.suspended', targetType: 'org', targetId: req.params.id });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/admin/orgs/:id/resume', async (req) => {
    const admin = requirePlatformAdmin(req);
    db.prepare("UPDATE organizations SET status = 'active', updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(nowIso(), req.params.id);
    audit(db, { orgId: req.params.id, actorUserId: admin.id, action: 'org.resumed', targetType: 'org', targetId: req.params.id });
    return { ok: true };
  });

  app.get('/api/admin/users', async (req) => {
    requirePlatformAdmin(req);
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.is_platform_admin, u.deleted_at, u.created_at, o.id AS org_id, o.name AS org_name
         FROM users u
         LEFT JOIN memberships m ON m.user_id = u.id
         LEFT JOIN organizations o ON o.id = m.org_id
         WHERE u.deleted_at IS NULL
         ORDER BY u.created_at DESC`
      )
      .all();
    return { users: rows };
  });

  app.post<{ Params: { id: string } }>('/api/admin/users/:id/promote', async (req) => {
    const admin = requirePlatformAdmin(req);
    if (req.params.id === admin.id) throw Errors.badRequest('Cannot promote yourself');
    const r = db.prepare('UPDATE users SET is_platform_admin = 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(nowIso(), req.params.id);
    if (r.changes === 0) throw Errors.notFound();
    audit(db, { actorUserId: admin.id, action: 'admin.user_promoted', targetType: 'user', targetId: req.params.id });
    return { ok: true };
  });

  app.get('/api/admin/audit', async (req) => {
    requirePlatformAdmin(req);
    const rows = db
      .prepare('SELECT id, org_id, actor_user_id, action, target_type, target_id, metadata, created_at FROM audit_events ORDER BY created_at DESC LIMIT 200')
      .all();
    return { events: rows };
  });
}
