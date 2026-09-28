import { z } from 'zod';
import { privilegedActionInputSchema } from './actions.js';

export const featureFlagSchema = z.object({
  id: z.string(),
  key: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string(),
  updatedByName: z.string().nullable(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const featureFlagListResponseSchema = z.object({
  items: z.array(featureFlagSchema),
});
export type FeatureFlagListResponse = z.infer<typeof featureFlagListResponseSchema>;

export const featureFlagUpdateRequestSchema = privilegedActionInputSchema.extend({
  enabled: z.boolean(),
});
export type FeatureFlagUpdateRequest = z.infer<typeof featureFlagUpdateRequestSchema>;

export const featureFlagUpdateResponseSchema = z.object({
  flag: featureFlagSchema,
  auditEventId: z.string(),
});
export type FeatureFlagUpdateResponse = z.infer<typeof featureFlagUpdateResponseSchema>;
