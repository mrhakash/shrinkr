# ADR-0004: Click retention by plan cap

## Context
Clicks grow unboundedly; Free plan needs a hard ceiling.

## Problem
Bound storage per link without losing the product's value (recent clicks + total count).

## Constraints
SQLite single-writer; no background workers in v1.

## Options considered
1. Cap rows per link (plan limit), prune oldest, keep running total in links.total_clicks
2. Unlimited rows, aggregate on read
3. Daily rollup job

## Decision
Option 1: `links.total_clicks` running counter + capped `clicks` detail rows.

## Reasons
O(1) count reads; bounded storage; no workers.

## Consequences
Historical detail beyond cap is dropped (documented in PRD/UI copy); counter is authoritative.

## Migration plan
N/A (initial).

## Rollback plan
Counter recomputable from clicks rows for capped window.

## Verification
Integration: insert cap+2 clicks → detail rows == cap, total_clicks == cap+2.
