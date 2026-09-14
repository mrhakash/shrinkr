# ADR-0001: Stack defaults (factory baseline)

## Context
Shrinkr is the first product built by the saas-factory skill; no user overrides given.

## Problem
Choose the v1 stack.

## Constraints
Node 22 present; single-machine deploy target; CI must run offline (no services).

## Options considered
1. Factory default: Fastify API + React/Vite SPA, SQLite, npm workspaces
2. Next.js full-stack
3. Express + server-rendered pages

## Decision
Factory default (option 1).

## Reasons
Matches skill defaults; API-first makes tenancy tests trivial via inject; SQLite zero-config for CI.

## Consequences
CORS+cookie config in dev (Vite proxy); two build targets.

## Migration plan
N/A (initial).

## Rollback plan
Standard porting effort; no lock-in.

## Verification
`npm ci && npm run build` green; API tests use `app.inject`.
