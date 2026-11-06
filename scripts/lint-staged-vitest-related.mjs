#!/usr/bin/env node
/**
 * Vitest selection for lint-staged: related tests per package, or full run when
 * shared/ changes (consumers depend on built types).
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const files = process.argv.slice(2);

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (files.length === 0) {
  process.exit(0);
}

const hasSharedChange = files.some((f) => f.startsWith('shared/') && f.endsWith('.ts'));

if (hasSharedChange) {
  run('client', 'npx', ['vitest', 'run']);
  run('server', 'npx', ['vitest', 'run']);
  process.exit(0);
}

const clientRelative = files
  .filter((f) => f.startsWith('client/') && (f.endsWith('.ts') || f.endsWith('.tsx')))
  .map((f) => f.slice('client/'.length));

const serverRelative = files
  .filter((f) => f.startsWith('server/') && f.endsWith('.ts'))
  .map((f) => f.slice('server/'.length));

if (clientRelative.length > 0) {
  run('client', 'npx', ['vitest', 'related', '--run', '--passWithNoTests', ...clientRelative]);
}
if (serverRelative.length > 0) {
  run('server', 'npx', ['vitest', 'related', '--run', '--passWithNoTests', ...serverRelative]);
}
