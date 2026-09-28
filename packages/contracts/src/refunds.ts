import { z } from 'zod';
import { decisionSchema } from './actions.js';

export const refundStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type RefundStatus = z.infer<typeof refundStatusSchema>;

export const syntheticTransactionSchema = z.object({
  id: z.string(),
  reference: z.string(),
  merchantName: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  occurredAt: z.string(),
  cardLast4: z.string(),
});
export type SyntheticTransaction = z.infer<typeof syntheticTransactionSchema>;

export const refundSummarySchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: refundStatusSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  customerLabel: z.string(),
  requestReason: z.string(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type RefundSummary = z.infer<typeof refundSummarySchema>;

export const refundDetailSchema = refundSummarySchema.extend({
  decisionReason: z.string().nullable(),
  decidedByName: z.string().nullable(),
  transaction: syntheticTransactionSchema,
});
export type RefundDetail = z.infer<typeof refundDetailSchema>;

export const refundListQuerySchema = z.object({
  status: refundStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});
export type RefundListQuery = z.infer<typeof refundListQuerySchema>;

export const refundListResponseSchema = z.object({
  items: z.array(refundSummarySchema),
});
export type RefundListResponse = z.infer<typeof refundListResponseSchema>;

export const refundDecisionResponseSchema = z.object({
  refund: refundDetailSchema,
  decision: decisionSchema,
  auditEventId: z.string(),
});
export type RefundDecisionResponse = z.infer<typeof refundDecisionResponseSchema>;
