import type { DatabaseClient } from '../database/index.js';
import { createActor } from '../authorization/index.js';
import type { Actor } from '../authorization/index.js';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionStore {
  create(userId: string): Promise<{ id: string; expiresAt: Date }>;
  resolveActor(sessionId: string): Promise<Actor | null>;
  destroy(sessionId: string): Promise<void>;
}

/** Server-side sessions. The browser only ever holds an opaque, signed session ID. */
export function createSessionStore(db: DatabaseClient, now: () => Date = () => new Date()): SessionStore {
  return {
    async create(userId) {
      const expiresAt = new Date(now().getTime() + SESSION_TTL_MS);
      const session = await db.session.create({ data: { userId, expiresAt }, select: { id: true, expiresAt: true } });
      return session;
    },

    async resolveActor(sessionId) {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: { user: { select: { id: true, displayName: true, role: true } } },
      });
      if (!session || session.expiresAt.getTime() <= now().getTime()) {
        return null;
      }
      return createActor(session.user);
    },

    async destroy(sessionId) {
      await db.session.deleteMany({ where: { id: sessionId } });
    },
  };
}
