# Data Model — Shrinkr v1.0

SQLite (WAL). Row-level tenancy: `org_id` on all tenant-owned tables.

## Tables

### users
id PK · email UNIQUE · name · password_hash (scrypt) · is_platform_admin (0/1) · deleted_at · created_at · updated_at

### organizations
id PK · name · slug UNIQUE · status (active|suspended) · deleted_at · created_at · updated_at

### memberships
id PK · org_id FK · user_id FK · role (owner|member) · created_at · UNIQUE(org_id, user_id)

### plans
id PK (free|pro|team) · name · price_cents (0/1900/4900) · max_links (5/100/1000) · max_clicks_tracked_per_link (100/10000/100000)

### subscriptions
id PK · org_id FK · plan_id FK · status (active|canceled) · current_period_start/end · canceled_at · created_at · updated_at
Partial UNIQUE(org_id) WHERE status='active'

### links
id PK · org_id FK · slug UNIQUE · target_url · title · created_by FK · created_at · updated_at · deleted_at (soft)

### clicks
id PK · link_id FK (→links.org_id carries tenancy) · org_id FK · occurred_at · referrer · user_agent · ip_hash (sha256, truncated)

## Indexes
- links(slug) UNIQUE, links(org_id), clicks(link_id), clicks(org_id)
- sessions(token_hash) UNIQUE, sessions(user_id)
- audit_events(org_id, created_at)

### sessions
id PK · user_id FK · token_hash UNIQUE · expires_at · revoked_at · created_at

### audit_events
id PK · org_id NULL · actor_user_id NULL · action · target_type · target_id · metadata (JSON) · created_at

## Retention
Clicks capped per link by plan (`max_clicks_tracked_per_link`); oldest pruned
on insert beyond cap. Sessions lazily purged. Users soft-deleted.

## Migration principles
Versioned SQL files in `apps/api/src/db/migrations/`, applied in order,
idempotent, recorded in `schema_migrations`.
