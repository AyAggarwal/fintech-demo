import { z } from 'zod';
import { roleSchema } from './auth.js';

export const auditEntityTypeSchema = z.enum(['REFUND', 'KYC_CASE', 'FEATURE_FLAG']);
export type AuditEntityType = z.infer<typeof auditEntityTypeSchema>;

export const auditActionSchema = z.enum([
  'refund.approved',
  'refund.rejected',
  'kyc.approved',
  'kyc.rejected',
  'feature_flag.enabled',
  'feature_flag.disabled',
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const auditEventSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  actorRole: roleSchema,
  action: auditActionSchema,
  entityType: auditEntityTypeSchema,
  entityId: z.string(),
  entityLabel: z.string(),
  reason: z.string().nullable(),
  before: jsonValueSchema,
  after: jsonValueSchema,
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditListQuerySchema = z.object({
  entityType: auditEntityTypeSchema.optional(),
  entityId: z.string().optional(),
  action: auditActionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export const auditListResponseSchema = z.object({
  items: z.array(auditEventSchema),
});
export type AuditListResponse = z.infer<typeof auditListResponseSchema>;
