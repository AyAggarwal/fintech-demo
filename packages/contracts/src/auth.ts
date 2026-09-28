import { z } from 'zod';

export const roleSchema = z.enum(['VIEWER', 'OPS_ANALYST', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  'refunds:read',
  'refunds:decide',
  'kyc:read',
  'kyc:decide',
  'feature-flags:read',
  'feature-flags:write',
  'audit:read',
]);
export type Permission = z.infer<typeof permissionSchema>;

/** Stable keys of the seeded demo identities. The login endpoint accepts nothing else. */
export const demoIdentityKeySchema = z.enum(['viewer', 'analyst', 'admin']);
export type DemoIdentityKey = z.infer<typeof demoIdentityKeySchema>;

export const demoLoginRequestSchema = z.object({
  identity: demoIdentityKeySchema,
});
export type DemoLoginRequest = z.infer<typeof demoLoginRequestSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: roleSchema,
  permissions: z.array(permissionSchema),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const demoIdentitySummarySchema = z.object({
  key: demoIdentityKeySchema,
  displayName: z.string(),
  role: roleSchema,
  description: z.string(),
});
export type DemoIdentitySummary = z.infer<typeof demoIdentitySummarySchema>;

export const sessionResponseSchema = z.object({
  user: currentUserSchema.nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const demoIdentitiesResponseSchema = z.object({
  identities: z.array(demoIdentitySummarySchema),
});
export type DemoIdentitiesResponse = z.infer<typeof demoIdentitiesResponseSchema>;
