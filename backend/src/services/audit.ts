import { query } from '../config/database.js';
import type { UserRole } from '../utils/jwt.js';

export interface AuditEntry {
  actorId?: string | null;
  actorType?: UserRole | 'anonymous';
  action: string;
  entity?: string;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persist a security-relevant event. Fire-and-forget by design: an audit
 * write must never break the user-facing request, so we swallow + log errors.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, actor_type, action, entity, entity_id, ip, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actorId ?? null,
        entry.actorType ?? 'anonymous',
        entry.action,
        entry.entity ?? null,
        entry.entityId ?? null,
        entry.ip ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );
  } catch (err) {
    console.error('[audit] failed to write audit log:', (err as Error).message, entry.action);
  }
}
