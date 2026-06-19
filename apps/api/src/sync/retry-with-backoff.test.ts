import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry-with-backoff.js';

// Characterization tests for withRetry.
// Uses vi.useFakeTimers() to control setTimeout so no real wall-clock waiting occurs.
// The logger (sync/logger.ts) writes to console — suppress it in tests.

beforeEach(() => {
  vi.useFakeTimers();
  // Silence console output from the logger inside withRetry
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * Run the withRetry promise and advance fake timers until it settles.
 * Returns a PromiseSettledResult so we can inspect the outcome.
 */
async function runWithFakeTimers<T>(
  promise: Promise<T>,
): Promise<PromiseSettledResult<T>> {
  const [result] = await Promise.allSettled([
    promise,
    vi.runAllTimersAsync(),
  ]);
  return result!;
}

/** Always-retryable predicate */
const alwaysRetry = () => true;

/** Never-retryable predicate */
const neverRetry = () => false;

// ─── happy path ────────────────────────────────────────────────────────────

describe('withRetry — success on first attempt', () => {
  it('returns the resolved value immediately', async () => {
    const result = await withRetry(async () => 42, alwaysRetry);
    expect(result).toBe(42);
  });

  it('calls fn exactly once when it succeeds', async () => {
    const fn = vi.fn(async () => 'ok');
    await withRetry(fn, alwaysRetry);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── success-after-retry ───────────────────────────────────────────────────

describe('withRetry — success after retry', () => {
  it('resolves after the first failure + one retry', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'recovered';
    });

    const settled = await runWithFakeTimers(
      withRetry(fn, alwaysRetry, { baseDelayMs: 100, jitterFactor: 0 }),
    );

    expect(settled.status).toBe('fulfilled');
    expect((settled as PromiseFulfilledResult<string>).value).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('resolves after multiple failures', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 4) throw new Error('transient');
      return 'success';
    });

    const settled = await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries: 5,
        baseDelayMs: 50,
        jitterFactor: 0,
      }),
    );

    expect(settled.status).toBe('fulfilled');
    expect((settled as PromiseFulfilledResult<string>).value).toBe('success');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

// ─── give up after maxRetries ──────────────────────────────────────────────

describe('withRetry — give up after maxRetries', () => {
  it('throws after exhausting retries', async () => {
    const err = new Error('always fails');
    const fn = vi.fn(async () => {
      throw err;
    });

    const settled = await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries: 3,
        baseDelayMs: 10,
        jitterFactor: 0,
      }),
    );

    expect(settled.status).toBe('rejected');
    expect((settled as PromiseRejectedResult).reason).toBe(err);
  });

  it('calls fn exactly maxRetries+1 times (initial + retries)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    const maxRetries = 3;

    await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries,
        baseDelayMs: 10,
        jitterFactor: 0,
      }),
    );

    // attempt=0,1,2,3 → 4 total calls (initial + 3 retries)
    expect(fn).toHaveBeenCalledTimes(maxRetries + 1);
  });

  it('default maxRetries is 5 (fn called 6 times total)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        baseDelayMs: 1,
        maxDelayMs: 10,
        jitterFactor: 0,
      }),
    );

    expect(fn).toHaveBeenCalledTimes(6); // 0..5 → 6 attempts
  });

  it('re-throws the original error, not a wrapper', async () => {
    class SpecialError extends Error {
      code = 402;
    }
    const original = new SpecialError('rate limited');
    const fn = vi.fn(async () => {
      throw original;
    });

    const settled = await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries: 1,
        baseDelayMs: 1,
        jitterFactor: 0,
      }),
    );

    expect(settled.status).toBe('rejected');
    expect((settled as PromiseRejectedResult).reason).toBe(original);
  });
});

// ─── non-retryable errors ──────────────────────────────────────────────────

describe('withRetry — non-retryable errors', () => {
  it('throws immediately without retrying when isRetryable returns false', async () => {
    const err = new Error('fatal');
    const fn = vi.fn(async () => {
      throw err;
    });

    // Non-retryable: rejects synchronously on first attempt (no timers needed)
    await expect(withRetry(fn, neverRetry)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls isRetryable with the thrown error', async () => {
    const err = new Error('check me');
    const isRetryable = vi.fn(() => false);
    const fn = vi.fn(async () => {
      throw err;
    });

    await expect(withRetry(fn, isRetryable)).rejects.toBe(err);
    expect(isRetryable).toHaveBeenCalledWith(err);
  });

  it('stops retrying as soon as isRetryable returns false', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      throw new Error(`call ${calls}`);
    });
    // Only retry on first error (call 1), then give up
    const isRetryable = vi.fn((err: unknown) => (err as Error).message === 'call 1');

    await runWithFakeTimers(
      withRetry(fn, isRetryable, {
        maxRetries: 5,
        baseDelayMs: 1,
        jitterFactor: 0,
      }),
    );

    // fn: call1 (throws "call 1" → retryable) → call2 (throws "call 2" → not retryable)
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── backoff growth ────────────────────────────────────────────────────────
// We verify the computed delays by intercepting setTimeout via fake timers.
// With jitterFactor=0 the delay is deterministic: base * 2^attempt (capped at maxDelayMs).

describe('withRetry — backoff growth (jitterFactor=0)', () => {
  it('delay doubles with each attempt (exponential)', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    // Capture delay values as they are scheduled
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay, ...args) => {
      if (typeof delay === 'number') delays.push(delay);
      return originalSetTimeout(fn as () => void, 0, ...args);
    });

    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 300_000,
        jitterFactor: 0,
      }),
    );

    // attempt 0 → 1000 * 2^0 = 1000
    // attempt 1 → 1000 * 2^1 = 2000
    // attempt 2 → 1000 * 2^2 = 4000
    expect(delays).toHaveLength(3);
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
  });

  it('caps delay at maxDelayMs', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay, ...args) => {
      if (typeof delay === 'number') delays.push(delay);
      return originalSetTimeout(fn as () => void, 0, ...args);
    });

    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterFactor: 0,
      }),
    );

    // After attempt 2 the uncapped delay would be 4000; attempt 3+ would be ≥8000 > 5000
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(5000);
    }
  });

  it('adds jitter on top of the base delay when jitterFactor > 0', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay, ...args) => {
      if (typeof delay === 'number') delays.push(delay);
      return originalSetTimeout(fn as () => void, 0, ...args);
    });

    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    await runWithFakeTimers(
      withRetry(fn, alwaysRetry, {
        maxRetries: 1,
        baseDelayMs: 1000,
        maxDelayMs: 300_000,
        jitterFactor: 0.5,
      }),
    );

    // base = 1000, jitter ∈ [0, 500) → delay ∈ [1000, 1500)
    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(1000);
    expect(delays[0]).toBeLessThan(1500);
  });
});
