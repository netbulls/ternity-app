import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Spins up an isolated Ternity stack (Postgres + api + web) via
// `scripts/test-instance.sh`, then records the workdir in
// `e2e/.last-instance.json` so globalTeardown + fixtures can find meta.json.
// Mirrors what the `/test-instance` skill does — same script, same contract,
// just driven by Playwright instead of an interactive command.

async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

export default async function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const workdir = mkdtempSync(path.join(tmpdir(), 'ternity-e2e.'));
  const logDir = path.join(workdir, 'logs');
  mkdirSync(logDir, { recursive: true });
  const port = await allocatePort();

  console.log(`[e2e] spinning up test instance (workdir: ${workdir})`);
  const r = spawnSync('bash', [path.join(root, 'scripts/test-instance.sh')], {
    env: {
      ...process.env,
      TEST_PORT: String(port),
      TEST_WORKDIR: workdir,
      TEST_LOG_DIR: logDir,
    },
    stdio: 'inherit',
    cwd: root,
  });
  if (r.status !== 0) {
    throw new Error(
      `scripts/test-instance.sh failed (exit ${r.status}). Logs under ${logDir}.`,
    );
  }

  // Sidecar file — globalTeardown runs in this same process but a fixture in
  // a worker still needs to find meta.json. Writing the path here is more
  // reliable than relying on env-var inheritance across worker forks.
  writeFileSync(
    path.join(root, 'e2e/.last-instance.json'),
    JSON.stringify({ workdir, metaPath: path.join(workdir, 'meta.json') }, null, 2),
  );
}
