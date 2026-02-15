import { log } from '../sync/logger.js';
import { transformClients } from '../sync/transform/clients.js';
import { transformProjects } from '../sync/transform/projects.js';
import { transformLabels } from '../sync/transform/labels.js';
import { transformTimeEntries } from '../sync/transform/time-entries.js';
import { transformLeaveTypes } from '../sync/transform/leave-types.js';
import { transformAbsences } from '../sync/transform/absences.js';

const TRANSFORMS: Record<string, () => Promise<{ created: number; updated: number; skipped: number }>> = {
  clients: transformClients,
  projects: transformProjects,
  labels: transformLabels,
  'time-entries': transformTimeEntries,
  'leave-types': transformLeaveTypes,
  absences: transformAbsences,
};

// Dependency order
const ORDER = ['clients', 'projects', 'labels', 'leave-types', 'time-entries', 'absences'];

const args = process.argv.slice(2);
let entity: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--entity' && args[i + 1]) entity = args[i + 1];
}

async function main() {
  const entities = entity ? [entity] : ORDER;

  log.info(`Starting transform: entities=${entities.join(', ')}`);

  const results: Record<string, { created: number; updated: number; skipped: number }> = {};

  for (const e of entities) {
    const fn = TRANSFORMS[e];
    if (!fn) {
      log.error(`Unknown entity: ${e}. Available: ${Object.keys(TRANSFORMS).join(', ')}`);
      process.exit(1);
    }
    results[e] = await fn();
  }

  log.info('\nTransform complete:');
  for (const [e, counts] of Object.entries(results)) {
    log.info(`  ${e}: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`);
  }

  process.exit(0);
}

main().catch((err) => {
  log.error(`Transform failed: ${err}`);
  process.exit(1);
});
