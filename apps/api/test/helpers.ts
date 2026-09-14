import { openDatabase, migrate, seedPlans } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import type { DB } from '../src/db/index.js';
import { randomUUID } from 'node:crypto';

export interface TestApp {
  app: FastifyInstance;
  db: DB;
}

export async function makeApp(opts?: { seedAdminEmail?: string }): Promise<TestApp> {
  const db = openDatabase(':memory:');
  migrate(db);
  seedPlans(db);
  // Per-app unique rate-limit key so parallel tests never share buckets.
  const appKey = randomUUID();
  const app = await buildApp({
    db, logger: false, seedAdminEmail: opts?.seedAdminEmail,
    rateLimitKey: () => appKey,
  });
  return { app, db };
}

export interface UserSession {
  cookies: string;
  userId: string;
  orgId: string;
}

export async function signup(app: FastifyInstance, email: string, password = 'password123', name = 'Test User'): Promise<UserSession> {
  const xff = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', headers: { 'x-forwarded-for': xff }, payload: { email, password, name } });
  if (res.statusCode !== 200) throw new Error(`signup failed ${res.statusCode}: ${res.body}`);
  const setCookie = res.headers['set-cookie'];
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c!.split(';')[0]).join('; ');
  const body = res.json() as { user: { id: string } };
  const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
  const meBody = me.json() as { org: { id: string } | null };
  return { cookies, userId: body.user.id, orgId: meBody.org!.id };
}

export function authHeaders(session: UserSession): { cookie: string } {
  return { cookie: session.cookies };
}
