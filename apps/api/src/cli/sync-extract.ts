import { log } from '../sync/logger.js';
import { extractAllToggl, type TogglEntity } from '../sync/toggl/extract.js';
import { extractAllTimetastic } from '../sync/timetastic/extract.js';

const args = process.argv.slice(2);
const source = args[0] ?? 'all';

let fromDate: string | undefined;
let toDate: string | undefined;
let entityFilter: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from' && args[i + 1]) fromDate = args[i + 1];
  if (args[i] === '--to' && args[i + 1]) toDate = args[i + 1];
  if (args[i] === '--entity' && args[i + 1]) entityFilter = args[i + 1];
}

async function main() {
  log.info(`Starting extract: source=${source} entity=${entityFilter ?? 'all'} from=${fromDate ?? 'default'} to=${toDate ?? 'today'}`);

  const results: Record<string, Record<string, number>> = {};

  if (source === 'toggl' || source === 'all') {
    const entities = entityFilter
      ? (entityFilter.split(',') as TogglEntity[])
      : undefined;
    results.toggl = await extractAllToggl(fromDate, toDate, entities);
  }

  if (source === 'timetastic' || source === 'all') {
    results.timetastic = await extractAllTimetastic(fromDate, toDate);
  }

  if (!['toggl', 'timetastic', 'all'].includes(source)) {
    log.error(`Unknown source: ${source}. Use: toggl | timetastic | all`);
    process.exit(1);
  }

  log.info('Extract complete:');
  for (const [src, counts] of Object.entries(results)) {
    for (const [entity, count] of Object.entries(counts)) {
      log.info(`  ${src}/${entity}: ${count} records`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  log.error(`Extract failed: ${err}`);
  process.exit(1);
});
