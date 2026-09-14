# ADR-0003: Slug generation and public redirect surface

## Context
Short links are the product's public face; must work without auth.

## Problem
Generate collision-free slugs; serve redirects safely.

## Constraints
Slugs user-visible; public endpoint must not leak tenancy or enable abuse.

## Options considered
1. 6-char base62 CSPRNG slug, collision-retry
2. Sequential ids (enumerable)
3. User-supplied only (collisions, squatting)

## Decision
Option 1; user-supplied slug allowed if available (validated charset, 3-30 chars).

## Reasons
Non-enumerable; short; user override preserves branding needs.

## Consequences
Redirect route must guard org suspension (410 Gone for suspended org links); target URL validated http(s) at creation.

## Migration plan
N/A.

## Rollback plan
N/A.

## Verification
Unit: collision retry bounded (10). Integration: javascript:/data: targets rejected 400; suspended org slug → 410.
