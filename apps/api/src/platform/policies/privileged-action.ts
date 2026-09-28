import type { AuditAction, AuditEntityType, JsonValue, Permission, PrivilegedActionInput } from '@fintech-demo/contracts';
import { recordAuditEvent } from '../audit/index.js';
import { requirePermission } from '../authorization/index.js';
import type { Actor } from '../authorization/index.js';
import type { DatabaseClient, TransactionClient } from '../database/index.js';
import { resolveActionReason } from './reason-policy.js';

/** What a feature's `apply` step must return so the platform can write the audit event. */
export interface AppliedChange<TResult> {
  entityId: string;
  entityLabel: string;
  before: JsonValue;
  after: JsonValue;
  result: TResult;
}

export interface PrivilegedAction<TResult> {
  actor: Actor;
  permission: Permission;
  action: AuditAction;
  entityType: AuditEntityType;
  input: PrivilegedActionInput;
  /**
   * Applies the business mutation using the transaction client. Must throw (NotFound/Conflict/Validation)
   * instead of returning when the change cannot be applied, so nothing is committed or audited.
   */
  apply: (tx: TransactionClient, context: { reason: string | null }) => Promise<AppliedChange<TResult>>;
}

export interface PrivilegedActionOutcome<TResult> {
  result: TResult;
  auditEventId: string;
}

/**
 * The common path for every privileged mutation in the console:
 * 1. permission check against the server-resolved actor,
 * 2. shared action-policy rules (reason handling),
 * 3. the feature's mutation and its audit event in one database transaction.
 */
export async function executePrivilegedAction<TResult>(
  db: DatabaseClient,
  action: PrivilegedAction<TResult>,
): Promise<PrivilegedActionOutcome<TResult>> {
  requirePermission(action.actor, action.permission);
  const reason = resolveActionReason(action.input);

  return db.$transaction(async (tx) => {
    const change = await action.apply(tx, { reason });
    const auditEvent = await recordAuditEvent(tx, {
      actor: action.actor,
      action: action.action,
      entityType: action.entityType,
      entityId: change.entityId,
      entityLabel: change.entityLabel,
      reason,
      before: change.before,
      after: change.after,
    });
    return { result: change.result, auditEventId: auditEvent.id };
  });
}
