#!/usr/bin/env node
// Node orchestrator for an isolated Ternity stack. Driven by test-instance.sh.
//
// Contract (env in): TEST_PORT, TEST_WORKDIR, TEST_LOG_DIR
// Contract (out):    $TEST_WORKDIR/pids, $TEST_WORKDIR/meta.json
//
// Lifecycle:
//   1. Allocate an api port (separate from the web TEST_PORT).
//   2. Start Postgres in Docker on a kernel-assigned host port.
//   3. Run migrations + seed via apps/api (`tsx src/test/seed-e2e.ts`).
//   4. Spawn api (Fastify, stub auth) and web (Vite dev, proxy → api).
//   5. Wait for /health on both.
//   6. Write pids + meta.json. Servers keep running detached.
//
// Teardown is the caller's job (see e2e/global-teardown.ts): kill pids and
// `docker stop` the container id recorded in meta.json.

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFileSync, openSync, existsSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const TEST_PORT = Number(process.env.TEST_PORT);
const TEST_WORKDIR = process.env.TEST_WORKDIR;
const TEST_LOG_DIR = process.env.TEST_LOG_DIR;
if (!TEST_PORT || !TEST_WORKDIR || !TEST_LOG_DIR) {
  console.error('Missing TEST_PORT / TEST_WORKDIR / TEST_LOG_DIR');
  process.exit(2);
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Bind to port 0 and read what the kernel handed us — guaranteed free. */
async function allocatePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = /** @type {import('node:net').AddressInfo} */ (srv.address()).port;
      srv.close(() => resolve(port));
    });
  });
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed (${r.status}):\n${r.stdout}\n${r.stderr}`,
    );
  }
  return r.stdout.trim();
}

async function pollUntil(label, fn, timeoutMs = 30_000, intervalMs = 250) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      if (await fn()) return;
    } catch (e) {
      lastErr = e;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Timed out waiting for ${label} after ${timeoutMs}ms${
      lastErr ? `: ${lastErr.message ?? lastErr}` : ''
    }`,
  );
}

function appendPid(pid, label) {
  // One "<pid> <label>" line per process — matches the test-instance skill contract.
  const line = `${pid} ${label}\n`;
  const existing = existsSync(path.join(TEST_WORKDIR, 'pids'))
    ? readFileSync(path.join(TEST_WORKDIR, 'pids'), 'utf8')
    : '';
  writeFileSync(path.join(TEST_WORKDIR, 'pids'), existing + line);
}

/** Spawn a long-lived process detached; redirect stdio to a log file under TEST_LOG_DIR. */
function spawnDetached(label, cmd, args, env) {
  const logPath = path.join(TEST_LOG_DIR, `${label}.log`);
  const fd = openSync(logPath, 'a');
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', fd, fd],
    detached: true,
  });
  child.unref();
  return child;
}

// ── 1. Allocate api port (web port comes from skill) ───────────────────────

const API_PORT = await allocatePort();

// ── 2. Postgres in Docker on a random host port ────────────────────────────

console.log('› starting Postgres in Docker…');
const containerId = sh('docker', [
  'run',
  '--detach',
  '--rm',
  '-e',
  'POSTGRES_DB=ternity',
  '-e',
  'POSTGRES_USER=ternity',
  '-e',
  'POSTGRES_PASSWORD=ternity',
  '-p',
  '127.0.0.1::5432',
  // Speed knobs that match the unit-test harness (the container is ephemeral —
  // durability is irrelevant and we want fast inserts for seeding + tests).
  'postgres:16-alpine',
  'postgres',
  '-c',
  'fsync=off',
  '-c',
  'synchronous_commit=off',
  '-c',
  'full_page_writes=off',
]);

// Resolve the kernel-assigned host port.
const portLine = sh('docker', ['port', containerId, '5432/tcp']);
const PG_HOST_PORT = Number(portLine.split(':').pop());
const DATABASE_URL = `postgresql://ternity:ternity@127.0.0.1:${PG_HOST_PORT}/ternity`;

await pollUntil('pg_isready', () => {
  const r = spawnSync('docker', ['exec', containerId, 'pg_isready', '-U', 'ternity'], {
    encoding: 'utf8',
  });
  return r.status === 0;
});
console.log(`  postgres ready on host port ${PG_HOST_PORT}`);

// ── 3. Migrations + seed (delegated to apps/api so deps resolve correctly) ─

console.log('› migrating + seeding…');
const seedOut = sh(
  'corepack',
  ['pnpm', '--filter', '@ternity/api', 'exec', 'tsx', 'test/seed-e2e.ts'],
  { cwd: ROOT, env: { ...process.env, DATABASE_URL } },
);
// The seed script prints a single JSON line with the IDs we hand to clients.
const seedIds = JSON.parse(seedOut.trim().split('\n').pop());

// ── 4. Spawn api + web detached ────────────────────────────────────────────

console.log(`› starting api on :${API_PORT}…`);
const api = spawnDetached(
  'api',
  'corepack',
  ['pnpm', '--filter', '@ternity/api', 'exec', 'tsx', 'src/server.ts'],
  {
    PORT: String(API_PORT),
    HOST: '127.0.0.1',
    DATABASE_URL,
    AUTH_MODE: 'stub',
    CORS_ORIGIN: `http://127.0.0.1:${TEST_PORT}`,
    NODE_ENV: 'test',
  },
);
appendPid(api.pid, 'api');

console.log(`› starting web on :${TEST_PORT}…`);
const web = spawnDetached(
  'web',
  'corepack',
  [
    'pnpm',
    '--filter',
    '@ternity/web',
    'exec',
    'vite',
    '--port',
    String(TEST_PORT),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ],
  {
    VITE_AUTH_MODE: 'stub',
    VITE_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
  },
);
appendPid(web.pid, 'web');

// ── 5. Wait for readiness ──────────────────────────────────────────────────

await pollUntil(
  'api /health',
  async () => {
    const r = await fetch(`http://127.0.0.1:${API_PORT}/health`).catch(() => null);
    return r?.ok ?? false;
  },
  60_000,
);
await pollUntil(
  'web /',
  async () => {
    const r = await fetch(`http://127.0.0.1:${TEST_PORT}/`).catch(() => null);
    return r?.ok ?? false;
  },
  60_000,
);

// ── 6. Meta + done ─────────────────────────────────────────────────────────

const meta = {
  webUrl: `http://127.0.0.1:${TEST_PORT}`,
  apiUrl: `http://127.0.0.1:${API_PORT}`,
  databaseUrl: DATABASE_URL,
  dockerContainerId: containerId,
  seed: seedIds,
};
writeFileSync(path.join(TEST_WORKDIR, 'meta.json'), JSON.stringify(meta, null, 2));

console.log('\n✓ test instance ready');
console.log(`  web: ${meta.webUrl}`);
console.log(`  api: ${meta.apiUrl}`);
console.log(`  db:  ${meta.databaseUrl}`);
console.log(`  meta: ${path.join(TEST_WORKDIR, 'meta.json')}`);
