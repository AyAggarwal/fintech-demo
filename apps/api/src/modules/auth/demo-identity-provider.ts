import type { DemoIdentityKey, DemoIdentitySummary, Role } from '@fintech-demo/contracts';
import type { DatabaseClient } from '../../platform/database/index.js';

export interface ResolvedIdentity {
  id: string;
  displayName: string;
  role: Role;
}

/**
 * Boundary where a real identity provider (OIDC) would plug in. The demo implementation can only
 * select one of the seeded users by key; it cannot create users or change roles.
 */
export interface IdentityProvider {
  listDemoIdentities(): Promise<DemoIdentitySummary[]>;
  resolveDemoIdentity(key: DemoIdentityKey): Promise<ResolvedIdentity | null>;
}

const DESCRIPTIONS: Record<DemoIdentityKey, string> = {
  viewer: 'Read-only access to every app and the audit trail.',
  analyst: 'Can approve or reject refunds and KYC cases.',
  admin: 'Analyst permissions plus feature-flag changes.',
};

export function createSeededIdentityProvider(db: DatabaseClient): IdentityProvider {
  return {
    async listDemoIdentities() {
      const users = await db.user.findMany({ orderBy: { demoKey: 'asc' }, select: { demoKey: true, displayName: true, role: true } });
      return users.flatMap((user) => {
        const key = toDemoKey(user.demoKey);
        return key ? [{ key, displayName: user.displayName, role: user.role, description: DESCRIPTIONS[key] }] : [];
      });
    },

    async resolveDemoIdentity(key) {
      return db.user.findUnique({ where: { demoKey: key }, select: { id: true, displayName: true, role: true } });
    },
  };
}

function toDemoKey(value: string): DemoIdentityKey | null {
  return value === 'viewer' || value === 'analyst' || value === 'admin' ? value : null;
}
