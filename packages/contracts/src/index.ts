export * from './auth.js';
export * from './errors.js';
export * from './actions.js';
export * from './refunds.js';
export * from './kyc.js';
export * from './feature-flags.js';
export * from './audit.js';
export * from './local-dev.js';

/** Custom header required on every mutating request; browsers cannot send it cross-origin without a CORS preflight. */
export const CSRF_HEADER_NAME = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'fintech-demo-console';
