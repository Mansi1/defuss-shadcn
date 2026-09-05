import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { walk } from './lib/audit.ts';

/**
 * Why: GitHub Pages publishes the documentation site from ./docs with no build
 * step, so the built dist/ tree must be mirrored there verbatim. The whole
 * tree (not just documentation/) because the pages reference `../components/…`
 * and `../theme/…` as siblings of documentation/ — a docs/documentation-only
 * copy would 404 every stylesheet on the published site.
 */

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'dist');
const OUT = join(ROOT, 'docs');

if (!existsSync(SRC)) {
  console.error('sync-docs: dist/ missing — run `bun run build` first');
  process.exit(1);
}

// full replace: a stale file from a previous publish must not survive the mirror
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, {
  recursive: true,
  // keep the published mirror byte-identical to what verify compares against
  filter: (src) => !src.endsWith('.DS_Store'),
});

const files = walk(OUT, ['']);
console.log(`sync-docs: ${files.length} files → docs/ (1:1 mirror of dist/, ready for GitHub Pages)`);
