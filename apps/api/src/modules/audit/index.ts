import type { DB } from '../../db/index.js';
import { newId } from '../../util/ids.js';
import { nowIso } from '../../util/time.js';

export function audit(
  db: DB,
  event: {
    orgId?: string | null;
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): void {
  db.prepare(
    `INSERT INTO audit_events (id, org_id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    event.orgId ?? null,
    event.actorUserId ?? null,
    event.action,
    event.targetType ?? null,
    event.targetId ?? null,
    event.metadata ? JSON.stringify(event.metadata) : null,
    nowIso()
  );
}
