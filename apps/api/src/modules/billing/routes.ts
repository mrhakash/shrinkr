import type { FastifyInstance } from 'fastify';
import type { DB } from '../../db/index.js';
import { Errors } from '../../util/errors.js';
import { requireActiveOrg } from '../../plugins/auth.js';
import { changePlan, countLinks, getActivePlan } from './quota.js';
import { audit } from '../audit/index.js';

export async function billingRoutes(app: FastifyInstance, opts: { db: DB }): Promise<void> {
  const { db } = opts;

  app.get('/api/billing/plans', async () => {
    const rows = db.prepare('SELECT id, name, price_cents, max_links, max_clicks_tracked_per_link FROM plans').all();
    return {
      mode: 'sandbox',
      plans: rows,
    };
  });

  app.get('/api/billing/subscription', async (req) => {
    const org = requireActiveOrg(req);
    const sub = db
      .prepare(
        `SELECT s.id, s.plan_id, s.status, s.current_period_start, s.current_period_end, p.name AS plan_name
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.org_id = ? AND s.status = 'active'`
      )
      .get(org.orgId) as
      | { id: string; plan_id: string; status: string; current_period_start: string; current_period_end: string; plan_name: string }
      | undefined;
    if (!sub) throw Errors.forbidden('No active subscription');
    return {
      subscription: sub,
      usage: { links: countLinks(db, org.orgId), maxLinks: getActivePlan(db, org.orgId).maxLinks },
    };
  });

  // Sandbox "checkout": one-step confirm
  app.post<{ Body: { planId?: string } }>('/api/billing/change-plan', async (req) => {
    const org = requireActiveOrg(req);
    const { planId } = req.body ?? {};
    if (!planId) throw Errors.badRequest('planId required');
    const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(planId);
    if (!plan) throw Errors.badRequest('Unknown plan');
    changePlan(db, org.orgId, planId);
    audit(db, {
      orgId: org.orgId, actorUserId: req.auth.user!.id,
      action: 'billing.plan_changed', targetType: 'plan', targetId: planId,
      metadata: { mode: 'sandbox' },
    });
    return { ok: true, mode: 'sandbox', planId };
  });
}
