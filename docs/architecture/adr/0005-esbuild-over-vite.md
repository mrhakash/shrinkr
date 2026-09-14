# ADR-0005: esbuild pipeline instead of Vite (Windows App Control constraint)

## Context
The build machine's Windows Application Control policy blocks rollup's
native binary (`@rollup/rollup-win32-x64-msvc.node`), which Vite 5 requires.
The same policy permits esbuild's binary (already proven working via tsx).

## Problem
Produce dev/build/preview scripts that work on this machine and in CI.

## Constraints
No admin control over App Control policy; CI (ubuntu) unaffected; keep React
SPA output shape (static bundle + index.html).

## Options considered
1. Vite with `--force` reinstall — policy still blocks the binary
2. esbuild ctx-based dev server + build script (custom, ~80 lines)
3. Parcel — also uses native binaries (swc) likely blocked too

## Decision
Option 2: esbuild for dev (watch + SPA fallback + API proxy), build, preview.

## Reasons
esbuild already trusted on this machine (tsx dependency); scripts are plain
Node, auditable; bundle output equivalent for a small SPA.

## Consequences
Custom dev server is minimal (no HMR websocket; manual refresh). Dev UX
slightly reduced; CI unaffected; revisit when App Control policy changes.

## Migration plan
When Vite becomes usable again, restore vite.config.ts + package scripts; no
app-code changes needed.

## Rollback plan
Revert this ADR + scripts; bundle entry unchanged.

## Verification
`npm run build` produces dist/assets/main.js + index.html; preview serves it;
dev server serves app at :5173 with /api and /r proxied to :3000.
