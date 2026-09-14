# Product Requirements — Shrinkr v1.0

**Status**: Approved · **Version**: 1.0.0

## Target users
Solo marketers and small teams who share many links and need to know which ones get clicked.

## Problem
Generic shorteners give no per-team ownership, no quotas, no admin oversight; links rot in spreadsheets with zero analytics.

## Promise
Shorten a link in seconds, watch clicks accumulate per link, all under your team's workspace with plan quotas.

## Primary workflow (golden path)
1. Sign up (email+password) → personal workspace on Free plan
2. Dashboard empty state → "Shorten your first link"
3. Paste long URL + optional slug → short link created, copied
4. Click row → detail view with click count and recent clicks
5. Visit short link (`/r/:slug`) → redirect + click recorded

## Plans & limits
| Plan | Price | Links | Clicks/link tracked |
|------|-------|-------|---------------------|
| Free | $0 | 5 | 100 |
| Pro | $19/mo | 100 | 10,000 |
| Team | $49/mo | 1,000 | 100,000 |

## Boundaries
**In scope**: auth (email/password, sessions), workspaces (tenants), sandbox billing with quotas, link CRUD, public redirect + click tracking, admin area (metrics, tenants, users, plans, audit), user settings (profile, password, delete account)
**Out of scope**: custom domains, QR codes, team invitations, real payments, email verification

## Success criteria
- Golden path works end-to-end via API
- Cross-workspace link access → 404 (tested)
- Quota enforcement: 6th link on Free → 402 (tested)
- All CI gates green; tagged v1.0.0 release

## Dependencies & risks
- None external; sandbox billing only (honest degradation per factory rules)
