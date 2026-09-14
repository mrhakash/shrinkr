-- Shrinkr v1.0 initial schema. Row-level tenancy: org_id on tenant tables.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','member')),
  created_at TEXT NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  max_links INTEGER NOT NULL,
  max_clicks_tracked_per_link INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active','canceled')),
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active
  ON subscriptions (org_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  slug TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  title TEXT,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_org ON links (org_id);

CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  link_id TEXT NOT NULL REFERENCES links(id),
  occurred_at TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks (link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_org ON clicks (org_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events (org_id, created_at);
