import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Why: `bun run e2e` runs every tests/e2e/*.e2e.ts as an isolated child
 * process (one crash must not hide the other components' results). Each file
 * is a standalone smoke test: it exits 0 on pass, non-zero on failure.
 */

const dir = import.meta.dirname;
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.e2e.ts'))
  .sort();

if (files.length === 0) {
  console.error('No *.e2e.ts tests found in tests/e2e/');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  console.log(`\n▶ ${file}`);
  const proc = Bun.spawnSync({
    cmd: [process.execPath, join(dir, file)],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (proc.exitCode !== 0) failed++;
}

console.log(`\n${files.length - failed}/${files.length} e2e file(s) passed`);
process.exit(failed ? 1 : 0);
