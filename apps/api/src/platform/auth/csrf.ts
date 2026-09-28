import type { FastifyRequest } from 'fastify';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@fintech-demo/contracts';
import { ForbiddenError } from '../errors/index.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CsrfOptions {
  allowedOrigins: readonly string[];
}

/**
 * Same-origin protection for cookie-authenticated mutations:
 * - a custom request header that browsers only send after a CORS preflight, and
 * - an Origin / Sec-Fetch-Site check when the browser supplies them.
 * Combined with SameSite=Lax cookies this blocks cross-site form posts and scripted requests.
 */
export function assertSameOriginMutation(request: FastifyRequest, options: CsrfOptions): void {
  if (!MUTATING_METHODS.has(request.method)) {
    return;
  }
  const marker = request.headers[CSRF_HEADER_NAME];
  if (marker !== CSRF_HEADER_VALUE) {
    throw new ForbiddenError(`Missing ${CSRF_HEADER_NAME} header`);
  }
  const fetchSite = request.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string' && fetchSite === 'cross-site') {
    throw new ForbiddenError('Cross-site requests are not allowed');
  }
  const origin = request.headers.origin;
  if (typeof origin === 'string' && !options.allowedOrigins.includes(origin)) {
    throw new ForbiddenError('Origin is not allowed');
  }
}
