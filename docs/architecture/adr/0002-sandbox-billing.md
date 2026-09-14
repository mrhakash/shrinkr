# ADR-0002: Sandbox billing

## Context
No payment provider credentials exist for this build.

## Problem
Ship plan/quota lifecycle without fabricating payment integration.

## Constraints
Factory rule: degrade honestly, never fake provider evidence.

## Options considered
1. Sandbox adapter (real internal entitlements, one-step confirm "checkout")
2. Stripe with test keys (keys unavailable)
3. No billing (violates PRD)

## Decision
Sandbox adapter behind BillingProvider seam; UI labels "Sandbox billing".

## Reasons
Quota/entitlement logic (the risky part) is exercised for real; Stripe swap later is config.

## Consequences
v1 takes no money; upgrade = confirm dialog.

## Migration plan
Add StripeProvider implementing same interface; env-select.

## Rollback plan
Provider stateless; env revert.

## Verification
Integration test: Free→Pro raises limits; downgrade below usage → 409 with clear error.
