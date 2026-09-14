import type { FastifyRequest } from 'fastify';

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();

type KeyFn = (req: FastifyRequest) => string;
let keyFn: KeyFn = (req) => req.ip;

/** Tests override this to key per-request; production default keys by client IP. */
export function setRateLimitKeyFn(fn: KeyFn): void {
  keyFn = fn;
}

export function rateLimit(scope: string, req: FastifyRequest, limit: number, windowMs: number): boolean {
  const key = `${scope}:${keyFn(req)}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref();
