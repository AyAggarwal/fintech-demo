import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorResponse } from '@fintech-demo/contracts';
import { AppError } from './app-error.js';

function isFastifyError(error: unknown): error is FastifyError {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'code' in error;
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    void reply.status(error.statusCode).send(body);
    return;
  }

  if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
    // Malformed JSON bodies, oversized payloads, unknown routes and similar client errors.
    const body: ErrorResponse = {
      error: {
        code: error.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR',
        message: error.message,
      },
    };
    void reply.status(error.statusCode).send(body);
    return;
  }

  request.log.error({ err: error }, 'Unhandled error');
  const body: ErrorResponse = {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  };
  void reply.status(500).send(body);
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply): void {
  const body: ErrorResponse = { error: { code: 'NOT_FOUND', message: 'Route not found' } };
  void reply.status(404).send(body);
}
