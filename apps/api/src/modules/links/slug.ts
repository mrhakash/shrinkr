import { randomSlug } from '../../util/ids.js';

const SLUG_RE = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_ATTEMPTS = 10;

export function isValidCustomSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function generateUniqueSlug(isTaken: (slug: string) => boolean): string {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const slug = randomSlug(6);
    if (!isTaken(slug)) return slug;
  }
  throw new Error('slug-exhaustion');
}

export function isSafeTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
