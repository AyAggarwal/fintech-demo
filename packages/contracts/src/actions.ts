import { z } from 'zod';

/**
 * Input shared by every privileged action (refund/KYC decisions, flag toggles).
 * The reason is currently optional; the server-side action policy owns that rule.
 */
export const privilegedActionInputSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type PrivilegedActionInput = z.infer<typeof privilegedActionInputSchema>;

export const decisionSchema = z.enum(['APPROVED', 'REJECTED']);
export type Decision = z.infer<typeof decisionSchema>;

export const decisionRequestSchema = privilegedActionInputSchema.extend({
  decision: decisionSchema,
});
export type DecisionRequest = z.infer<typeof decisionRequestSchema>;
