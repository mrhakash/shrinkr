import type { FastifyInstance } from 'fastify';
import type { DB } from '../../db/index.js';
import { newId } from '../../util/ids.js';
import { nowIso } from '../../util/time.js';
import { Errors } from '../../util/errors.js';
import { createHash } from 'node:crypto';
import { requireActiveOrg } from '../../plugins/auth.js';
import { assertLinkQuota, getActivePlan } from '../billing/quota.js';
import { generateUniqueSlug, isSafeTarget, isValidCustomSlug } from './slug.js';
import { audit } from '../audit/index.js';

interface CreateLinkBody { targetUrl?: string; slug?: string; title?: string }

export async function linkRoutes(app: FastifyInstance, opts: { db: DB }): Promise<void> {
  const { db } = opts;

  // Org-scoped CRUD (authenticated)
  app.get('/api/links', async (req) => {
    const org = requireActiveOrg(req);
    const rows = db
      .prepare(
        `SELECT id, slug, target_url, title, total_clicks, created_at
         FROM links WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
      )
      .all(org.orgId);
    return { links: rows, plan: getActivePlan(db, org.orgId) };
  });

  app.post<{ Body: CreateLinkBody }>('/api/links', async (req) => {
    const org = requireActiveOrg(req);
    const { targetUrl, slug: customSlug, title } = req.body ?? {};
    if (!targetUrl || !isSafeTarget(targetUrl)) {
      throw Errors.badRequest('targetUrl must be a valid http(s) URL');
    }
    if (customSlug !== undefined && customSlug !== '' && !isValidCustomSlug(customSlug)) {
      throw Errors.badRequest('Custom slug must be 3-30 chars: letters, numbers, -, _');
    }
    assertLinkQuota(db, org.orgId);

    const isTaken = (s: string) =>
      db.prepare('SELECT 1 FROM links WHERE slug = ? AND deleted_at IS NULL').get(s) !== undefined;
    let slug: string;
    if (customSlug) {
      if (isTaken(customSlug)) throw Errors.conflict('Slug already taken');
      slug = customSlug;
    } else {
      slug = generateUniqueSlug(isTaken);
    }

    const id = newId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO links (id, org_id, slug, target_url, title, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, org.orgId, slug, targetUrl, title?.trim() || null, req.auth.user!.id, now, now);
    audit(db, { orgId: org.orgId, actorUserId: req.auth.user!.id, action: 'link.created', targetType: 'link', targetId: id });
    const row = db.prepare('SELECT id, slug, target_url, title, total_clicks, created_at FROM links WHERE id = ?').get(id);
    return { link: row };
  });

  app.get<{ Params: { id: string } }>('/api/links/:id', async (req) => {
    const org = requireActiveOrg(req);
    const row = db
      .prepare(
        `SELECT id, slug, target_url, title, total_clicks, created_at
         FROM links WHERE id = ? AND org_id = ? AND deleted_at IS NULL`
      )
      .get(req.params.id, org.orgId);
    if (!row) throw Errors.notFound();
    return { link: row };
  });

  app.delete<{ Params: { id: string } }>('/api/links/:id', async (req) => {
    const org = requireActiveOrg(req);
    const result = db
      .prepare('UPDATE links SET deleted_at = ?, updated_at = ? WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
      .run(nowIso(), nowIso(), req.params.id, org.orgId);
    if (result.changes === 0) throw Errors.notFound();
    audit(db, { orgId: org.orgId, actorUserId: req.auth.user!.id, action: 'link.deleted', targetType: 'link', targetId: req.params.id });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/api/links/:id/clicks', async (req) => {
    const org = requireActiveOrg(req);
    const link = db
      .prepare('SELECT id FROM links WHERE id = ? AND org_id = ? AND deleted_at IS NULL')
      .get(req.params.id, org.orgId);
    if (!link) throw Errors.notFound();
    const rows = db
      .prepare('SELECT occurred_at, referrer, user_agent FROM clicks WHERE link_id = ? ORDER BY occurred_at DESC LIMIT 100')
      .all(req.params.id);
    return { clicks: rows };
  });

  // Public redirect — no auth, org-suspension aware, click recording
  app.get<{ Params: { slug: string } }>('/r/:slug', async (req, reply) => {
    const row = db
      .prepare(
        `SELECT l.id, l.target_url, l.org_id, o.status AS org_status
         FROM links l JOIN organizations o ON o.id = l.org_id
         WHERE l.slug = ? AND l.deleted_at IS NULL`
      )
      .get(req.params.slug) as
      | { id: string; target_url: string; org_id: string; org_status: 'active' | 'suspended' }
      | undefined;
    if (!row) throw Errors.notFound('Short link not found');
    if (row.org_status === 'suspended') throw Errors.gone('This short link is unavailable');

    const plan = getActivePlan(db, row.org_id);
    const now = nowIso();
    const cap = plan.maxClicksTrackedPerLink;
    const tx = db.transaction(() => {
      db.prepare('UPDATE links SET total_clicks = total_clicks + 1 WHERE id = ?').run(row.id);
      const count = (db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE link_id = ?').get(row.id) as { c: number }).c;
      if (count < cap) {
        db.prepare(
          `INSERT INTO clicks (id, org_id, link_id, occurred_at, referrer, user_agent, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          newId(), row.org_id, row.id, now,
          typeof req.headers.referer === 'string' ? req.headers.referer.slice(0, 512) : null,
          typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 256) : null,
          createHash('sha256').update(req.ip ?? '').digest('hex').slice(0, 16)
        );
      } else {
        db.prepare('DELETE FROM clicks WHERE link_id = ? AND id IN (SELECT id FROM clicks WHERE link_id = ? ORDER BY occurred_at ASC LIMIT 1)').run(row.id, row.id);
        db.prepare(
          `INSERT INTO clicks (id, org_id, link_id, occurred_at, referrer, user_agent, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          newId(), row.org_id, row.id, now,
          typeof req.headers.referer === 'string' ? req.headers.referer.slice(0, 512) : null,
          typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 256) : null,
          createHash('sha256').update(req.ip ?? '').digest('hex').slice(0, 16)
        );
      }
    });
    tx();
    return reply.redirect(row.target_url, 302);
  });
}
