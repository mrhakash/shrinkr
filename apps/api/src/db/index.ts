import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type DB = Database.Database;

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');

export function openDatabase(path: string): DB {
  if (path !== ':memory:') {
    mkdirSync(join(path, '..'), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function migrate(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name)
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const insert = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf-8');
    db.transaction(() => {
      db.exec(sql);
      insert.run(name, new Date().toISOString());
    })();
  }
}

export function seedPlans(db: DB): void {
  const stmt = db.prepare(
    `INSERT INTO plans (id, name, price_cents, max_links, max_clicks_tracked_per_link)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  );
  stmt.run('free', 'Free', 0, 5, 100);
  stmt.run('pro', 'Pro', 1900, 100, 10000);
  stmt.run('team', 'Team', 4900, 1000, 100000);
}
