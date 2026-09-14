import { loadEnv } from './config/env.js';
import { openDatabase, migrate, seedPlans } from './db/index.js';
import { buildApp } from './app.js';

const env = loadEnv();
const db = openDatabase(env.dbPath);
migrate(db);
seedPlans(db);

const app = await buildApp({
  db,
  webOrigin: env.webOrigin,
  cookieSecret: env.cookieSecret,
  seedAdminEmail: env.seedAdminEmail,
  logger: true,
});

app.listen({ port: env.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`shrinkr api on :${env.port}`);
});
