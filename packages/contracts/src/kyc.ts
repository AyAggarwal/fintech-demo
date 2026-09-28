import { z } from 'zod';
import { decisionSchema } from './actions.js';

export const kycStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type KycStatus = z.infer<typeof kycStatusSchema>;

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskFlagSchema = z.object({
  code: z.string(),
  label: z.string(),
  severity: riskLevelSchema,
});
export type RiskFlag = z.infer<typeof riskFlagSchema>;

export const kycCaseSummarySchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: kycStatusSchema,
  applicantLabel: z.string(),
  accountType: z.enum(['INDIVIDUAL', 'BUSINESS']),
  riskLevel: riskLevelSchema,
  riskFlagCount: z.number().int(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type KycCaseSummary = z.infer<typeof kycCaseSummarySchema>;

export const kycCaseDetailSchema = kycCaseSummarySchema.extend({
  riskFlags: z.array(riskFlagSchema),
  notes: z.string(),
  decisionReason: z.string().nullable(),
  decidedByName: z.string().nullable(),
});
export type KycCaseDetail = z.infer<typeof kycCaseDetailSchema>;

export const kycListQuerySchema = z.object({
  status: kycStatusSchema.optional(),
  riskLevel: riskLevelSchema.optional(),
  search: z.string().trim().max(100).optional(),
});
export type KycListQuery = z.infer<typeof kycListQuerySchema>;

export const kycListResponseSchema = z.object({
  items: z.array(kycCaseSummarySchema),
});
export type KycListResponse = z.infer<typeof kycListResponseSchema>;

export const kycDecisionResponseSchema = z.object({
  kycCase: kycCaseDetailSchema,
  decision: decisionSchema,
  auditEventId: z.string(),
});
export type KycDecisionResponse = z.infer<typeof kycDecisionResponseSchema>;
