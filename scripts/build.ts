#!/usr/bin/env bun
import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Why: the whole build — `bun run build` produces dist/ from src/ 1:1.
 * tsc handles .ts → .js (type stripping, see tsconfig.json); every other
 * file type is copied verbatim so the dist shape stays exactly what the
 * CDN/Netlify consumers expect.
 */

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// fresh tree so deleted sources never linger in dist/
rmSync(DIST, { recursive: true, force: true });

// 1. TypeScript → JavaScript (emits straight into dist/, same structure)
const tsc = Bun.spawnSync({
  cmd: ['bunx', 'tsc', '-p', ROOT],
  stdout: 'inherit',
  stderr: 'inherit',
});
if (tsc.exitCode !== 0) {
  console.error('tsc failed');
  process.exit(tsc.exitCode);
}

// 2. everything that isn't a .ts source is copied as-is (tsc already wrote
//    the .js twins into dist/, so only the originals are skipped)
cpSync(SRC, DIST, { recursive: true, filter: (s) => !s.endsWith('.ts') });

console.log('dist/ built from src/');
