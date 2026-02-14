import { log } from '../sync/logger.js';
import { matchUsers } from '../sync/transform/users.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');

async function main() {
  log.info(`User matching: mode=${apply ? 'APPLY' : 'DRY RUN'}`);
  const report = await matchUsers(apply);

  log.info('\n=== User Match Report ===');

  if (report.matched.length > 0) {
    log.info(`\nMatched (${report.matched.length}):`);
    for (const m of report.matched) {
      log.info(`  ${m.email} → ${m.userId} (toggl=${m.togglId ?? '-'}, tt=${m.timetasticId ?? '-'})`);
    }
  }

  if (report.created.length > 0) {
    log.info(`\nCreated (${report.created.length}):`);
    for (const c of report.created) {
      log.info(`  ${c.email} → ${c.userId} (source: ${c.source})`);
    }
  }

  if (report.unmatched.length > 0) {
    log.info(`\nUnmatched (${report.unmatched.length}):`);
    for (const u of report.unmatched) {
      log.info(`  ${u.email} (source: ${u.source})`);
    }
    if (!apply) {
      log.info('\nRun with --apply to create users for unmatched emails.');
    }
  }

  log.info(`\nSummary: ${report.matched.length} matched, ${report.created.length} created, ${report.unmatched.length} unmatched`);
  process.exit(0);
}

main().catch((err) => {
  log.error(`User matching failed: ${err}`);
  process.exit(1);
});
