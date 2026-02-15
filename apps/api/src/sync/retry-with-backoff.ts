import { log } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 300_000, // 5 minutes
  jitterFactor: 0.5,
};

function calculateDelay(attempt: number, opts: RetryOptions): number {
  const base = Math.min(opts.baseDelayMs * 2 ** attempt, opts.maxDelayMs);
  const jitter = base * Math.random() * opts.jitterFactor;
  return base + jitter;
}

/**
 * Retry a function with exponential backoff + jitter.
 *
 * @param fn - The async function to execute
 * @param isRetryable - Predicate that decides if an error is worth retrying
 * @param options - Backoff configuration
 * @returns The result of fn()
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.maxRetries || !isRetryable(err)) {
        throw err;
      }
      const delay = calculateDelay(attempt, opts);
      log.warn(
        `Retryable error (attempt ${attempt + 1}/${opts.maxRetries}), retrying in ${Math.round(delay)}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
