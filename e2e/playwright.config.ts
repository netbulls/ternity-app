import { defineConfig, devices } from '@playwright/test';

// E2E suite for Ternity happy paths. `globalSetup` spins up an isolated stack
// (Postgres + api + web on random ports, seeded fixtures) via `scripts/test-
// instance.sh` and writes its meta.json path to TERNITY_E2E_META so specs can
// resolve baseURL + seeded user IDs. `globalTeardown` kills the recorded pids
// and `docker stop`s the Postgres container. Specs run serially against the
// one shared instance — each happy path is self-describing and creates its
// own data with unique names/dates to avoid stepping on the others.

export default defineConfig({
  testDir: './specs',
  fullyParallel: false, // one shared backend; parallel writes muddy the picture
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  use: {
    // baseURL is resolved at fixture time from e2e/.last-instance.json
    // (written by globalSetup) — see fixtures/test.ts.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
