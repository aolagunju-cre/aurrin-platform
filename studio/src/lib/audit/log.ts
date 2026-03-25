/**
 * Audit logging utility.
 * Creates immutable audit log entries in the audit_logs table.
 * Called for sensitive operations: role changes, score locks, approvals, exports, etc.
 */

import { getSupabaseClient } from '../db/client';
import { logger } from '../logging/logger';

export type AuditAction =
  | 'role_assigned'
  | 'role_revoked'
  | 'event_status_changed'
  | 'score_locked'
  | 'score_published'
  | 'founder_approved'
  | 'entitlement_granted'
  | 'entitlement_revoked'
  | 'export_created'
  | 'file_uploaded'
  | 'file_deleted'
  | string;

export interface AuditLogContext {
  request_id?: string;
  job_id?: string;
  ip_address?: string;
  user_agent?: string;
  [key: string]: unknown;
}

export interface AuditLogEffect {
  resource_type: string;
  resource_id?: string | null;
  changes?: { before?: unknown; after?: unknown; [key: string]: unknown };
  reason?: string | null;
}

/**
 * Creates an immutable audit log entry.
 * @param action - The operation performed (e.g., 'role_assigned', 'score_locked')
 * @param actor - The user ID performing the action
 * @param effect - What was affected (resource type, ID, and changes)
 * @param context - Optional request/job context (request_id, job_id, etc.)
 */
export async function auditLog(
  action: AuditAction,
  actor: string,
  effect: AuditLogEffect,
  context?: AuditLogContext
): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.db.insertAuditLog({
      actor_id: actor,
      action,
      resource_type: effect.resource_type,
      resource_id: effect.resource_id ?? null,
      changes: effect.changes ?? {},
      reason: effect.reason ?? null,
    });

    if (error) {
      logger.error('Failed to write audit log', {
        request_id: context?.request_id,
        job_id: context?.job_id,
        action: 'audit_log_write_failed',
        actor,
        auditAction: action,
        error: error.message,
      });
    } else {
      logger.info('Audit log written', {
        request_id: context?.request_id,
        job_id: context?.job_id,
        action,
        actor,
        resource_type: effect.resource_type,
        resource_id: effect.resource_id,
      });
    }
  } catch (err) {
    // Never throw from audit logging — log the failure and continue
    logger.error('Unexpected error writing audit log', {
      request_id: context?.request_id,
      action: 'audit_log_unexpected_error',
      actor,
      auditAction: action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
