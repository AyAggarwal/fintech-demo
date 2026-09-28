import type { ZodType } from 'zod';
import { ValidationError } from '../errors/index.js';

/** Parses untrusted request input against a Zod schema, mapping failures to a consistent 400 response. */
export function parseInput<T>(schema: ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  return raise(new ValidationError(`Invalid ${label}`, details));
}

function raise(error: Error): never {
  throw error;
}
