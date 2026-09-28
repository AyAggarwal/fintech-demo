import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE, errorResponseSchema } from '@fintech-demo/contracts';
import type { ErrorCode } from '@fintech-demo/contracts';
import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: readonly { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isPermissionDenied(): boolean {
    return this.code === 'FORBIDDEN';
  }

  get isUnauthenticated(): boolean {
    return this.code === 'UNAUTHENTICATED';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}

async function parseError(response: Response): Promise<ApiError> {
  const fallback = new ApiError(response.status, 'INTERNAL_ERROR', `Request failed with status ${response.status}`);
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return fallback;
    }
    const { code, message, details } = parsed.data.error;
    return new ApiError(response.status, code, message, details);
  } catch {
    return fallback;
  }
}

/**
 * Same-origin fetch wrapper. The session is carried by an HTTP-only cookie set by the API;
 * mutating requests carry the custom header the API requires as a CSRF guard.
 */
export async function apiRequest<T>(path: string, schema: ZodType<T>, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') {
    headers[CSRF_HEADER_NAME] = CSRF_HEADER_VALUE;
  }
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? null : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw await parseError(response);
  }
  return schema.parse(await response.json());
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details && error.details.length > 0) {
      return `${error.message}: ${error.details.map((d) => `${d.path} ${d.message}`).join('; ')}`;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
