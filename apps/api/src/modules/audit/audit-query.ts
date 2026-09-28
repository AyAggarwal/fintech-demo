import { auditActionSchema, auditEntityTypeSchema, jsonValueSchema } from '@fintech-demo/contracts';
import type { AuditEvent, AuditListQuery, JsonValue } from '@fintech-demo/contracts';
import type { AuditEvent as AuditEventRecord } from '@prisma/client';
import type { DatabaseClient } from '../../platform/database/index.js';

function toJsonValue(value: AuditEventRecord['before']): JsonValue {
  return jsonValueSchema.parse(value);
}

function toAuditEvent(record: AuditEventRecord): AuditEvent {
  return {
    id: record.id,
    actorId: record.actorId,
    actorName: record.actorName,
    actorRole: record.actorRole,
    action: auditActionSchema.parse(record.action),
    entityType: auditEntityTypeSchema.parse(record.entityType),
    entityId: record.entityId,
    entityLabel: record.entityLabel,
    reason: record.reason,
    before: toJsonValue(record.before),
    after: toJsonValue(record.after),
    createdAt: record.createdAt.toISOString(),
  };
}

export async function findAuditEvent(db: DatabaseClient, id: string): Promise<AuditEvent | null> {
  const record = await db.auditEvent.findUnique({ where: { id } });
  return record ? toAuditEvent(record) : null;
}

export async function listAuditEvents(db: DatabaseClient, query: AuditListQuery): Promise<AuditEvent[]> {
  const records = await db.auditEvent.findMany({
    where: {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
  return records.map(toAuditEvent);
}
