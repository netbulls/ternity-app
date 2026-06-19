import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users } from '../db/schema.js';
import { jiraRoutes } from './jira.js';

// POST /api/jira/exchange validates the body (JiraExchangeSchema) before touching any
// external Atlassian call, so a malformed/missing `code` is a 400, not a 500 (S4).
// Only the validation path is exercised here — the happy path hits the live OAuth API.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(jiraRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser() {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'U', email: `u${Math.random()}@x.io`, globalRole: 'user' })
    .returning();
  return u!;
}

const post = async (userId: string, body?: unknown) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/jira/exchange',
    headers: { 'x-dev-user-id': userId },
    payload: body as object,
  });
  return res.statusCode;
};

describe('POST /api/jira/exchange — body validation (S4)', () => {
  it('returns 400 when code is missing', async () => {
    const u = await makeUser();
    expect(await post(u.id, {})).toBe(400);
  });

  it('returns 400 when code is empty or the wrong type', async () => {
    const u = await makeUser();
    expect(await post(u.id, { code: '' })).toBe(400);
    expect(await post(u.id, { code: 123 })).toBe(400);
  });

  it('returns 400 when the body is missing entirely', async () => {
    const u = await makeUser();
    expect(await post(u.id)).toBe(400);
  });
});
