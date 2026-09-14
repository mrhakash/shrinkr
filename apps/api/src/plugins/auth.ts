import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DB } from '../db/index.js';
import { resolveSession, SESSION_COOKIE, type SessionUser } from '../modules/auth/session.js';
import { Errors } from '../util/errors.js';

export interface OrgContext {
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgStatus: 'active' | 'suspended';
  role: 'owner' | 'member';
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: { user: SessionUser | null; sessionId: string | null; org: OrgContext | null };
  }
}

async function authInner(app: FastifyInstance, opts: { db: DB }): Promise<void> {
  const { db } = opts;
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.auth = { user: null, sessionId: null, org: null };
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const resolved = resolveSession(db, token);
    if (!resolved) return;
    req.auth.user = resolved.user;
    req.auth.sessionId = resolved.sessionId;
    const org = db
      .prepare(
        `SELECT o.id, o.name, o.slug, o.status, m.role
         FROM memberships m JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ? AND o.deleted_at IS NULL
         ORDER BY m.created_at ASC LIMIT 1`
      )
      .get(resolved.user.id) as
      | { id: string; name: string; slug: string; status: 'active' | 'suspended'; role: 'owner' | 'member' }
      | undefined;
    if (org) {
      req.auth.org = {
        orgId: org.id, orgName: org.name, orgSlug: org.slug,
        orgStatus: org.status, role: org.role,
      };
    }
  });
}

// fastify-plugin breaks encapsulation so every route (any register scope) gets req.auth
export const authPlugin = fp(authInner, { name: 'auth-plugin' });

export function requireAuth(req: FastifyRequest): SessionUser {
  if (!req.auth || !req.auth.user) throw Errors.unauthorized();
  return req.auth.user;
}

export function requireActiveOrg(req: FastifyRequest): OrgContext {
  requireAuth(req);
  if (!req.auth.org) throw Errors.forbidden('No workspace membership');
  if (req.auth.org.orgStatus === 'suspended') throw Errors.forbidden('Workspace suspended. Contact support.');
  return req.auth.org;
}

export function requirePlatformAdmin(req: FastifyRequest): SessionUser {
  const user = requireAuth(req);
  if (!user.isPlatformAdmin) throw Errors.forbidden('Platform admin required');
  return user;
}
