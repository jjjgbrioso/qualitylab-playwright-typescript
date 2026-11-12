import { randomUUID } from 'node:crypto';

/**
 * A small amount between 1.01 and 9.99 (in cents). The bank refuses an identical transaction within
 * 30 seconds, and small amounts keep the test customer's balances stable over many runs.
 */
export function uniqueSmallAmountCents(): number {
  return 101 + Math.floor(Math.random() * 899);
}

/** A key for API calls that must not be repeated, such as deposits. */
export function idempotencyKey(): string {
  return randomUUID();
}

/** A short random suffix for names that must not clash between parallel tests. */
export function shortId(): string {
  return randomUUID().slice(0, 8);
}
