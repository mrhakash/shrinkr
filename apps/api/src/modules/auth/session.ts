import { createHash, randomBytes } from 'node:crypto';
import type { DB } from '../../db/index.js';
import { newId } from '../../util/ids.js';
import { nowIso, isoPlusDays } from '../../util/time.js';

const SESSION_DAYS = 7;
export const SESSION_COOKIE = 'shrinkr_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: DB, userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url');
  const id = newId();
  const expiresAt = isoPlusDays(SESSION_DAYS);
  db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, hashToken(token), expiresAt, nowIso());
  return { token, expiresAt };
}

export function resolveSession(db: DB, token: string): { user: SessionUser; sessionId: string } | null {
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.revoked_at,
              u.id, u.email, u.name, u.is_platform_admin, u.deleted_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | {
        session_id: string; expires_at: string; revoked_at: string | null;
        id: string; email: string; name: string; is_platform_admin: number; deleted_at: string | null;
      }
    | undefined;
  if (!row || row.revoked_at || row.deleted_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return {
    user: {
      id: row.id, email: row.email, name: row.name,
      isPlatformAdmin: row.is_platform_admin === 1,
    },
    sessionId: row.session_id,
  };
}

export function revokeSession(db: DB, sessionId: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(nowIso(), sessionId);
}

export function revokeAllUserSessions(db: DB, userId: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), userId);
}
