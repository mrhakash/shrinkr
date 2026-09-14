export interface Env {
  port: number;
  dbPath: string;
  cookieSecret: string;
  webOrigin: string | undefined;
  seedAdminEmail: string | undefined;
}

export function loadEnv(): Env {
  return {
    port: Number(process.env.PORT ?? 3000),
    dbPath: process.env.SHRINKR_DB_PATH ?? 'data/shrinkr.sqlite',
    cookieSecret: process.env.SHRINKR_COOKIE_SECRET ?? 'dev-insecure-cookie-secret',
    webOrigin: process.env.SHRINKR_WEB_ORIGIN,
    seedAdminEmail: process.env.SHRINKR_SEED_ADMIN_EMAIL,
  };
}
