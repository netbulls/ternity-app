import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../../test/app.js';

// Direct integration tests for the global error handler. Existing route tests check
// `response.statusCode` but never the response body, so several mutations in
// error-handler.ts survived the mutation run (`'Validation failed' → ""`, response
// object stripped to `{}`, the `??` fallback flipped to `&&` which would return
// undefined for unset error.message/code in production).
//
// These tests pin the documented response shape AND the fallback behaviour so a
// regression in either gets caught.

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp(async (f) => {
    // Route that throws a ZodError to exercise the validation branch.
    f.post('/test/throw-zod', async (request) => {
      return z.object({ name: z.string() }).parse(request.body);
    });

    // Route that throws an Error with NO message and NO code — exercises the
    // generic branch's `?? 'Internal server error'` / `?? 'INTERNAL_ERROR'`
    // fallbacks. `??` is correct (only falls back on null/undefined); a regression
    // to `&&` would return undefined here and the assertions below would fail.
    f.get('/test/throw-bare', async () => {
      const err = new Error();
      // new Error().message is '' (falsy but defined). Force undefined so the
      // ?? path is exercised in the asymmetric way that exposes a `&&` mutation.
      (err as { message?: string }).message = undefined;
      throw err;
    });

    // Route that throws an error with statusCode + message + code — exercises the
    // pass-through path: the handler must forward statusCode, surface message, and
    // surface code as-is.
    f.get('/test/throw-with-meta', async () => {
      const err = new Error('teapot') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 418;
      err.code = 'IM_A_TEAPOT';
      throw err;
    });
  });
});

afterAll(async () => {
  await app.close();
});

describe('global error handler — ZodError path', () => {
  it('returns 400 with the documented body shape', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/throw-zod',
      payload: {},
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string; code: string; issues: unknown[] }>();
    expect(body).toMatchObject({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
    });
    // `issues` is the array from ZodError — must be non-empty, with a path/message
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});

describe('global error handler — generic error path', () => {
  it('falls back to "Internal server error" + "INTERNAL_ERROR" when error.message and error.code are undefined', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/throw-bare' });

    expect(res.statusCode).toBe(500);
    // The literal default strings — kill the `?? -> &&` LogicalOperator mutants
    // (which would return undefined when error.message/code are undefined) AND the
    // 'Internal server error'/'INTERNAL_ERROR' → "" StringLiteral mutants.
    expect(res.json()).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('forwards statusCode and surfaces message + code from a thrown error', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/throw-with-meta' });

    expect(res.statusCode).toBe(418);
    expect(res.json()).toEqual({
      error: 'teapot',
      code: 'IM_A_TEAPOT',
    });
  });
});
