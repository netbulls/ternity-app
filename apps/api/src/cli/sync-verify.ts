import { log } from '../sync/logger.js';
import { verifyTogglEntries } from '../sync/toggl/verify.js';

const args = process.argv.slice(2);
const source = args[0] ?? 'toggl';

let fromYear: number | undefined;
let toYear: number | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from' && args[i + 1]) fromYear = parseInt(args[i + 1]!, 10);
  if (args[i] === '--to' && args[i + 1]) toYear = parseInt(args[i + 1]!, 10);
}

async function main() {
  if (source !== 'toggl') {
    log.error(`Unknown source: ${source}. Currently supported: toggl`);
    process.exit(1);
  }

  log.info('=== Sync Verification ===');
  log.info('');

  const result = await verifyTogglEntries(fromYear, toYear);

  process.exit(result.allMatch ? 0 : 1);
}

main().catch((err) => {
  log.error(`Verification failed: ${err}`);
  process.exit(1);
});
