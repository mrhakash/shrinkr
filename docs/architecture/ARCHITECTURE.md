# Architecture — Shrinkr v1.0

**Status**: Design specification (implemented by initial PR) · **ADRs**: adr/0001..0004

## Topology
npm workspaces monorepo:
- `apps/api` — Fastify + TypeScript, SQLite (better-sqlite3, WAL), port 3000
- `apps/web` — React + Vite SPA, dev proxy → API, port 5173

## Trust boundaries
- **Public**: `POST /api/auth/signup|login`, `GET /health`, `GET /r/:slug` (redirect)
- **Authenticated**: session cookie required
- **Workspace-scoped**: links, clicks — every query filters by server-resolved `org_id`
- **Platform admin**: `/api/admin/*` — `users.is_platform_admin = 1`

## Request flow (authz invariant)
```
Request → session cookie → resolveSession (sha256 lookup, revocation, expiry)
       → requireAuth (401) → requireActiveOrg (403 suspended) → requirePlatformAdmin (403)
       → handler → org-scoped query → response
```
Cross-tenant reads/writes → 404. Suspended org → 403. Over quota → 402.

## Components
- `apps/api/src/plugins/auth.ts` — session resolution + guards
- `apps/api/src/modules/auth` — signup/login/logout/me, scrypt, sessions
- `apps/api/src/modules/orgs` — provisioning, suspension
- `apps/api/src/modules/billing` — plans, subscriptions, quota engine
- `apps/api/src/modules/links` — CRUD + slug generation + redirect + click recording
- `apps/api/src/modules/admin` — metrics, tenant/user mgmt, audit log
- `apps/api/src/db/` — migrations (0001_init.sql), seed plans

## Redirect pipeline (public surface)
`GET /r/:slug` → lookup link by slug (active org only) → 302 to target URL →
fire-and-record click (async insert, never blocks redirect). Slugs: 6-char
base62 CSPRNG; collision → regenerate (bounded retries). Only `http(s)`
targets accepted (no `javascript:`, `data:` — open-redirect/malware guard at
creation, not at click time).

## Multi-tenancy
Row-level: `org_id` on links, clicks, subscriptions, memberships. Suspension
blocks API AND public redirects for that org's links (404/410 semantics).

## Sessions & security
scrypt passwords; 32-byte session tokens, HttpOnly+SameSite=Lax cookie,
sha256-stored, 7-day expiry; rate limit signup/login 10/min/IP; audit log for
admin + billing + auth events; parameterized SQL everywhere.
