import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import type { DB } from './db/index.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { linkRoutes } from './modules/links/routes.js';
import { billingRoutes } from './modules/billing/routes.js';
import { adminRoutes } from './modules/admin/routes.js';

export interface AppOptions {
  db: DB;
  webOrigin?: string;
  cookieSecret?: string;
  seedAdminEmail?: string;
  logger?: boolean;
  /** Override the rate-limit client key (tests). Production default: ip. */
  rateLimitKey?: (req: { ip: string; headers: Record<string, unknown> }) => string;
}

import { setRateLimitKeyFn } from './plugins/rateLimit.js';

export async function buildApp(opts: AppOptions) {
  const app = Fastify({
    logger: opts.logger ?? false,
    // Trust proxy only when an explicit web origin is configured (production behind a proxy).
    // In tests/dev without webOrigin we do NOT trust X-Forwarded-For, preventing rate-limit bypass.
    trustProxy: Boolean(opts.webOrigin),
  });
  await app.register(cookie, { secret: opts.cookieSecret ?? 'dev-insecure' });
  await app.register(cors, {
    origin: opts.webOrigin ?? true,
    credentials: true,
  });

  app.get('/health', async () => ({ ok: true, name: 'shrinkr', version: '1.0.0' }));
  if (opts.rateLimitKey) setRateLimitKeyFn(opts.rateLimitKey);

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin, { db: opts.db });
  await app.register(authRoutes, { db: opts.db, seedAdminEmail: opts.seedAdminEmail });
  await app.register(linkRoutes, { db: opts.db });
  await app.register(billingRoutes, { db: opts.db });
  await app.register(adminRoutes, { db: opts.db });

  return app;
}
