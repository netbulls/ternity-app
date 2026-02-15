import { log } from '../sync/logger.js';
import { extractAllToggl } from '../sync/toggl/extract.js';
import { extractAllTimetastic } from '../sync/timetastic/extract.js';
import { matchUsers } from '../sync/transform/users.js';
import { transformClients } from '../sync/transform/clients.js';
import { transformProjects } from '../sync/transform/projects.js';
import { transformLabels } from '../sync/transform/labels.js';
import { transformTimeEntries } from '../sync/transform/time-entries.js';
import { transformLeaveTypes } from '../sync/transform/leave-types.js';
import { transformAbsences } from '../sync/transform/absences.js';

const args = process.argv.slice(2);

let fromDate: string | undefined;
let toDate: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from' && args[i + 1]) fromDate = args[i + 1];
  if (args[i] === '--to' && args[i + 1]) toDate = args[i + 1];
}

async function main() {
  log.info(`Full sync run: from=${fromDate ?? 'default'} to=${toDate ?? 'today'}`);

  // Step 1: Extract
  log.info('\n── Extract ──');
  const togglCounts = await extractAllToggl(fromDate, toDate);
  const ttCounts = await extractAllTimetastic(fromDate, toDate);

  // Step 2: User matching (auto-apply)
  log.info('\n── User Matching ──');
  const userReport = await matchUsers(true);
  log.info(
    `Users: ${userReport.matched.length} matched, ${userReport.created.length} created`,
  );

  // Step 3: Transform (dependency order)
  log.info('\n── Transform ──');
  await transformClients();
  await transformProjects();
  await transformLabels();
  await transformLeaveTypes();
  await transformTimeEntries();
  await transformAbsences();

  log.info('\nFull sync complete.');
  log.info('Extract totals:');
  for (const [entity, count] of Object.entries(togglCounts)) {
    log.info(`  toggl/${entity}: ${count}`);
  }
  for (const [entity, count] of Object.entries(ttCounts)) {
    log.info(`  timetastic/${entity}: ${count}`);
  }

  process.exit(0);
}

main().catch((err) => {
  log.error(`Sync run failed: ${err}`);
  process.exit(1);
});
