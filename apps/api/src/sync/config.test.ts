import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Characterization tests for sync/config.ts.
//
// The module uses module-level caching (`let cached`). Because Vitest shares
// the module registry within a file, we must `vi.resetModules()` + fresh
// dynamic import to get a clean cache state for each test.
//
// env vars are manipulated directly on process.env and restored in afterEach.

import { vi } from 'vitest';

// Env vars required by getSyncConfig
const FULL_ENV = {
  TOGGL_API_TOKEN: 'tok-toggl',
  TOGGL_WORKSPACE_ID: 'ws-123',
  TOGGL_ORGANIZATION_ID: 'org-456',
  TIMETASTIC_API_TOKEN: 'tok-timetastic',
  DATABASE_URL: 'postgres://localhost/test',
};

// Env vars required by getTogglConfig (subset)
const TOGGL_ENV = {
  TOGGL_API_TOKEN: 'tok-toggl',
  TOGGL_WORKSPACE_ID: 'ws-123',
  TOGGL_ORGANIZATION_ID: 'org-456',
  DATABASE_URL: 'postgres://localhost/test',
};

// Env vars required by getTimetasticConfig (subset)
const TIMETASTIC_ENV = {
  TIMETASTIC_API_TOKEN: 'tok-timetastic',
  DATABASE_URL: 'postgres://localhost/test',
};

/** Keys managed by these tests. Saved before each test, restored after. */
const MANAGED_KEYS = [
  'TOGGL_API_TOKEN',
  'TOGGL_WORKSPACE_ID',
  'TOGGL_ORGANIZATION_ID',
  'TIMETASTIC_API_TOKEN',
  'DATABASE_URL',
] as const;

let saved: Partial<Record<(typeof MANAGED_KEYS)[number], string | undefined>>;

beforeEach(() => {
  vi.resetModules();
  // Save and clear managed env vars
  saved = {};
  for (const k of MANAGED_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  // Restore original env
  for (const k of MANAGED_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

// Helper: sets env vars and imports a fresh module
async function importConfig(env: Record<string, string>) {
  Object.assign(process.env, env);
  return import('./config.js');
}

// ─── getSyncConfig ──────────────────────────────────────────────────────────

describe('getSyncConfig', () => {
  it('returns all five fields when every env var is set', async () => {
    const { getSyncConfig } = await importConfig(FULL_ENV);
    const cfg = getSyncConfig();
    expect(cfg).toEqual({
      togglApiToken: 'tok-toggl',
      togglWorkspaceId: 'ws-123',
      togglOrganizationId: 'org-456',
      timetasticApiToken: 'tok-timetastic',
      databaseUrl: 'postgres://localhost/test',
    });
  });

  it('throws when TOGGL_API_TOKEN is missing', async () => {
    const env = { ...FULL_ENV };
    delete (env as Partial<typeof env>).TOGGL_API_TOKEN;
    const { getSyncConfig } = await importConfig(env as Record<string, string>);
    expect(() => getSyncConfig()).toThrow('TOGGL_API_TOKEN');
  });

  it('throws when TOGGL_WORKSPACE_ID is missing', async () => {
    const env = { ...FULL_ENV };
    delete (env as Partial<typeof env>).TOGGL_WORKSPACE_ID;
    const { getSyncConfig } = await importConfig(env as Record<string, string>);
    expect(() => getSyncConfig()).toThrow('TOGGL_WORKSPACE_ID');
  });

  it('throws when TOGGL_ORGANIZATION_ID is missing', async () => {
    const env = { ...FULL_ENV };
    delete (env as Partial<typeof env>).TOGGL_ORGANIZATION_ID;
    const { getSyncConfig } = await importConfig(env as Record<string, string>);
    expect(() => getSyncConfig()).toThrow('TOGGL_ORGANIZATION_ID');
  });

  it('throws when TIMETASTIC_API_TOKEN is missing', async () => {
    const env = { ...FULL_ENV };
    delete (env as Partial<typeof env>).TIMETASTIC_API_TOKEN;
    const { getSyncConfig } = await importConfig(env as Record<string, string>);
    expect(() => getSyncConfig()).toThrow('TIMETASTIC_API_TOKEN');
  });

  it('throws when DATABASE_URL is missing', async () => {
    const env = { ...FULL_ENV };
    delete (env as Partial<typeof env>).DATABASE_URL;
    const { getSyncConfig } = await importConfig(env as Record<string, string>);
    expect(() => getSyncConfig()).toThrow('DATABASE_URL');
  });

  it('lists ALL missing vars in the error message when several are absent', async () => {
    const { getSyncConfig } = await importConfig({});
    // All five vars missing — error must mention each one
    expect(() => getSyncConfig()).toThrow(
      /TOGGL_API_TOKEN.*TOGGL_WORKSPACE_ID.*TOGGL_ORGANIZATION_ID.*TIMETASTIC_API_TOKEN.*DATABASE_URL/,
    );
  });

  it('error message starts with "Missing required env vars:"', async () => {
    const { getSyncConfig } = await importConfig({});
    expect(() => getSyncConfig()).toThrow(/^Missing required env vars:/);
  });

  it('returns the cached object on subsequent calls (referential equality)', async () => {
    const { getSyncConfig } = await importConfig(FULL_ENV);
    const a = getSyncConfig();
    const b = getSyncConfig();
    expect(a).toBe(b);
  });
});

// ─── getTogglConfig ─────────────────────────────────────────────────────────

describe('getTogglConfig', () => {
  it('returns the four Toggl fields when Toggl env vars are set', async () => {
    const { getTogglConfig } = await importConfig(TOGGL_ENV);
    const cfg = getTogglConfig();
    expect(cfg).toEqual({
      togglApiToken: 'tok-toggl',
      togglWorkspaceId: 'ws-123',
      togglOrganizationId: 'org-456',
      databaseUrl: 'postgres://localhost/test',
    });
  });

  it('does NOT require TIMETASTIC_API_TOKEN', async () => {
    // Only Toggl vars + DATABASE_URL — no Timetastic — must not throw
    const { getTogglConfig } = await importConfig(TOGGL_ENV);
    expect(() => getTogglConfig()).not.toThrow();
  });

  it('throws when TOGGL_API_TOKEN is missing', async () => {
    const env = { ...TOGGL_ENV };
    delete (env as Partial<typeof env>).TOGGL_API_TOKEN;
    const { getTogglConfig } = await importConfig(env as Record<string, string>);
    expect(() => getTogglConfig()).toThrow('TOGGL_API_TOKEN');
  });

  it('error message prefix is "Missing required env vars for Toggl:"', async () => {
    const { getTogglConfig } = await importConfig({});
    expect(() => getTogglConfig()).toThrow(/^Missing required env vars for Toggl:/);
  });

  it('does not cache (unlike getSyncConfig) — each call re-reads process.env', async () => {
    // getTogglConfig has no caching mechanism — verify by changing env between calls
    const { getTogglConfig } = await importConfig(TOGGL_ENV);
    const first = getTogglConfig();
    process.env.TOGGL_API_TOKEN = 'tok-different';
    const second = getTogglConfig();
    // Different objects, and the second one picks up the changed value
    expect(second.togglApiToken).toBe('tok-different');
    expect(first).not.toBe(second);
  });
});

// ─── getTimetasticConfig ────────────────────────────────────────────────────

describe('getTimetasticConfig', () => {
  it('returns the two Timetastic fields when env vars are set', async () => {
    const { getTimetasticConfig } = await importConfig(TIMETASTIC_ENV);
    const cfg = getTimetasticConfig();
    expect(cfg).toEqual({
      timetasticApiToken: 'tok-timetastic',
      databaseUrl: 'postgres://localhost/test',
    });
  });

  it('does NOT require any Toggl env vars', async () => {
    const { getTimetasticConfig } = await importConfig(TIMETASTIC_ENV);
    expect(() => getTimetasticConfig()).not.toThrow();
  });

  it('throws when TIMETASTIC_API_TOKEN is missing', async () => {
    const { getTimetasticConfig } = await importConfig({ DATABASE_URL: 'postgres://x' });
    expect(() => getTimetasticConfig()).toThrow('TIMETASTIC_API_TOKEN');
  });

  it('throws when DATABASE_URL is missing', async () => {
    const { getTimetasticConfig } = await importConfig({
      TIMETASTIC_API_TOKEN: 'tok-timetastic',
    });
    expect(() => getTimetasticConfig()).toThrow('DATABASE_URL');
  });

  it('error message prefix is "Missing required env vars for Timetastic:"', async () => {
    const { getTimetasticConfig } = await importConfig({});
    expect(() => getTimetasticConfig()).toThrow(/^Missing required env vars for Timetastic:/);
  });
});
