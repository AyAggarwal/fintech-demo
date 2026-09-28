import type { AuditAction, AuditEntityType, JsonValue } from '@fintech-demo/contracts';
import { Prisma } from '@prisma/client';
import type { Actor } from '../authorization/index.js';
import type { TransactionClient } from '../database/index.js';

export interface AuditEventInput {
  actor: Actor;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  reason: string | null;
  before: JsonValue;
  after: JsonValue;
}

function toStoredJson(value: JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value;
}

/**
 * Appends one audit event. Always called with the transaction client of the mutation being recorded,
 * so the business change and its audit event commit or roll back together.
 */
export async function recordAuditEvent(tx: TransactionClient, input: AuditEventInput): Promise<{ id: string }> {
  return tx.auditEvent.create({
    data: {
      actorId: input.actor.id,
      actorName: input.actor.displayName,
      actorRole: input.actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      reason: input.reason,
      before: toStoredJson(input.before),
      after: toStoredJson(input.after),
    },
    select: { id: true },
  });
}
