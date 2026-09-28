import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';

export const SESSION_COOKIE_NAME = 'fintech_demo_session';

export interface SessionCookieOptions {
  secure: boolean;
}

function baseOptions(options: SessionCookieOptions): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    signed: true,
  };
}

export function setSessionCookie(reply: FastifyReply, sessionId: string, expiresAt: Date, options: SessionCookieOptions): void {
  void reply.setCookie(SESSION_COOKIE_NAME, sessionId, { ...baseOptions(options), expires: expiresAt });
}

export function clearSessionCookie(reply: FastifyReply, options: SessionCookieOptions): void {
  void reply.clearCookie(SESSION_COOKIE_NAME, baseOptions(options));
}

/** Returns the verified session ID from the signed cookie, or null when absent or tampered with. */
export function readSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE_NAME];
  if (raw === undefined) {
    return null;
  }
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}
