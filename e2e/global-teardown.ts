import { readFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tears down whatever globalSetup brought up: kill the recorded pids and
// `docker stop` the Postgres container. Best-effort — if a piece is already
// dead we keep going so the workdir still gets cleaned up.

export default async function globalTeardown() {
  const root = path.resolve(__dirname, '..');
  const sidecar = path.join(root, 'e2e/.last-instance.json');
  if (!existsSync(sidecar)) {
    console.log('[e2e] no .last-instance.json — nothing to tear down');
    return;
  }
  const { workdir, metaPath } = JSON.parse(readFileSync(sidecar, 'utf8'));

  const pidsPath = path.join(workdir, 'pids');
  if (existsSync(pidsPath)) {
    for (const line of readFileSync(pidsPath, 'utf8').split('\n').filter(Boolean)) {
      const [pidStr, label] = line.split(' ');
      const pid = Number(pidStr);
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`[e2e] killed ${label} (pid ${pid})`);
      } catch {
        // already gone — fine
      }
    }
  }

  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    if (meta.dockerContainerId) {
      spawnSync('docker', ['stop', meta.dockerContainerId], { stdio: 'ignore' });
      console.log(`[e2e] stopped container ${meta.dockerContainerId.slice(0, 12)}`);
    }
  }

  rmSync(workdir, { recursive: true, force: true });
  rmSync(sidecar, { force: true });
}
