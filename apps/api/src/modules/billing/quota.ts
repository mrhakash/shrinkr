import type { DB } from '../../db/index.js';
import { Errors } from '../../util/errors.js';

export interface PlanLimits {
  id: string;
  name: string;
  priceCents: number;
  maxLinks: number;
  maxClicksTrackedPerLink: number;
}

export function getActivePlan(db: DB, orgId: string): PlanLimits {
  const row = db
    .prepare(
      `SELECT p.id, p.name, p.price_cents, p.max_links, p.max_clicks_tracked_per_link
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.org_id = ? AND s.status = 'active'`
    )
    .get(orgId) as
    | { id: string; name: string; price_cents: number; max_links: number; max_clicks_tracked_per_link: number }
    | undefined;
  if (!row) throw Errors.forbidden('No active subscription');
  return {
    id: row.id, name: row.name, priceCents: row.price_cents,
    maxLinks: row.max_links, maxClicksTrackedPerLink: row.max_clicks_tracked_per_link,
  };
}

export function countLinks(db: DB, orgId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM links WHERE org_id = ? AND deleted_at IS NULL')
    .get(orgId) as { c: number };
  return row.c;
}

export function assertLinkQuota(db: DB, orgId: string): void {
  const plan = getActivePlan(db, orgId);
  if (countLinks(db, orgId) >= plan.maxLinks) {
    throw Errors.quotaExceeded(`Plan ${plan.name} allows ${plan.maxLinks} links. Upgrade for more.`);
  }
}

export function changePlan(db: DB, orgId: string, newPlanId: string): void {
  const plan = db.prepare('SELECT id, max_links FROM plans WHERE id = ?').get(newPlanId) as
    | { id: string; max_links: number }
    | undefined;
  if (!plan) throw Errors.badRequest('Unknown plan');
  const used = countLinks(db, orgId);
  if (used > plan.max_links) {
    throw Errors.conflict(`Cannot downgrade: ${used} links exceed ${plan.id} limit (${plan.max_links}). Delete links first.`);
  }
  const now = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE subscriptions SET status='canceled', canceled_at=?, updated_at=? WHERE org_id=? AND status='active'`
    ).run(now, now, orgId);
    db.prepare(
      `INSERT INTO subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), orgId, newPlanId, now, periodEnd, now, now);
  });
  tx();
}
