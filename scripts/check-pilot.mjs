// Local pilot gate. PostgreSQL mode requires an explicitly disposable TEST_DATABASE_URL.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const db = process.argv.includes('--postgres');
const http = process.argv.includes('--http');
if (http && !db) throw new Error('--http requires --postgres');
if (db && !process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable test database');
if (http && !existsSync('.next/BUILD_ID')) throw new Error('Run the production build before --http');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const base = pkg.scripts.smoke.split(' && ').map(x => x.replace('npm run ', ''));
const extra = ['smoke:fcm', 'smoke:native-logout', 'smoke:paperwork-state', 'smoke:native-confirmation', 'smoke:native-paperwork', 'smoke:native-work-storage', 'smoke:driver-start-ui', 'smoke:native-work', 'smoke:driver-experience', 'smoke:receipt-draft', 'smoke:native-tracking', 'smoke:gps-time', 'smoke:native-api', 'smoke:native-actions', 'smoke:driver-control', 'smoke:native-notifications'];
const suites = [...base, ...extra];
if (db) suites.push('smoke:card-periods', 'smoke:harsh', 'smoke:reliability:pg');
if (http) suites.push('smoke:driver-integrity:http', 'smoke:truck-history:http', 'smoke:mobile:http');
// Never let test code fall back to the application database.
const env = { ...process.env, DATABASE_URL: '', TEST_DATABASE_URL: db ? process.env.TEST_DATABASE_URL : '' };
if (db) {
  const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], { env: { ...env, DATABASE_URL: env.TEST_DATABASE_URL }, stdio: 'inherit' });
  if (migration.status !== 0) process.exit(1);
}
const failed = [];
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const command = pkg.scripts[suite];
  const file = command.match(/scripts\/[\w-]+\.mts/)?.[0];
  if (!file) throw new Error(`No test file for ${suite}`);
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', file, ...(command.includes('--postgres') ? ['--postgres'] : [])], { env, stdio: 'inherit' });
  if (result.status !== 0) failed.push(suite);
}
console.log(`\nPilot: ${suites.length - failed.length}/${suites.length} suites passed.`);
if (!db || !http) console.log('PARTIAL: PostgreSQL/HTTP acceptance requires --postgres --http and a disposable TEST_DATABASE_URL.');
console.log('Physical iPhone, Safari production and live owner/driver acceptance remain manual gates.');
if (failed.length) { console.error('FAILED:', failed.join(', ')); process.exit(1); }
