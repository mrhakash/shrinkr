# Shrinkr

Multi-tenant link shortener SaaS with click analytics, plan quotas, and an
admin area. Built by the `saas-factory` skill as a live test.

## Quickstart

```bash
npm install
cp .env.example .env
npm run dev        # API :3000, web :5173
```

## Verify

```bash
npm run verify:all   # lint + typecheck + test + build
```

## Docs

- [PRD](docs/product/PRD.md) · [Architecture](docs/architecture/ARCHITECTURE.md) · [Data Model](docs/architecture/DATA-MODEL.md) · [ADRs](docs/architecture/adr/)

## Status

v1.0.0 — sandbox billing (no real payments), no deployment configured.
