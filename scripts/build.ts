#!/usr/bin/env bun
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSearchIndexText } from './lib/search-index.ts';
import { SKILL_OUTPUT_FILE } from './lib/skill.ts';
import { buildSkillText } from './lib/skill-files.ts';

/**
 * Why: the whole build — `bun run build` produces dist/ from src/ 1:1.
 * tsc handles .ts → .js (type stripping, see tsconfig.json); every other
 * file type is copied verbatim so the dist shape stays exactly what the
 * CDN/Netlify consumers expect.
 *
 * Special case: components import the shared State API preamble from
 * src/components/_shared/, but shipped .js files must stay isolated
 * copy-paste/CDN-ready single files. A post-pass inlines the compiled helper
 * into each importer (replacing the import statement) and drops _shared/
 * from dist/ — the browser never sees an inter-component module graph.
 */

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
// any named import from the shared helper file, e.g. `{ defussGlobals }` or
// `{ defussGlobals, safeShowPopover }` — the whole helper is inlined either way
const SHARED_IMPORT = /import \{[^}]+\} from '\.\.\/\.\.\/shared\/state-api\.js';\n/;

// fresh tree so deleted sources never linger in dist/
rmSync(DIST, { recursive: true, force: true });

// 0. regenerate the docs search index into src/ BEFORE copying, so the palette
// index in dist/ (and the docs/ mirror) can never lag the doc pages. The
// source of truth is the NAV array + every page's <h2>s, both of which live
// in src/, so this is a pure function of the tree we're about to copy.
writeFileSync(join(SRC, 'documentation/js/search-index.js'), buildSearchIndexText());

// 0b. regenerate the agent-facing SKILL.md index from src/SKILL_tpl.md + the
// component-skill.md frontmatter, BEFORE copying, so dist/SKILL.md (the file
// agents actually read) can never lag the skills.
writeFileSync(join(SRC, SKILL_OUTPUT_FILE), buildSkillText(SRC));

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

// inline the shared preamble into each component .js that imports it, so the
// shipped files keep zero local module dependencies
const helperPath = join(DIST, 'shared', 'state-api.js');
if (existsSync(helperPath)) {
  // drop `export` — each module gets its own hoisted copy of the functions
  const helper = readFileSync(helperPath, 'utf8').replace(/^export /gm, '');
  for (const dir of readdirSync(join(DIST, 'components'))) {
    const js = join(DIST, 'components', dir, `${dir}.js`);
    if (!existsSync(js)) continue;
    const code = readFileSync(js, 'utf8');
    // function replacer: the helper's comments contain backtick-$-backtick,
    // which string replacements would interpret as `$` (pre-match) patterns
    if (SHARED_IMPORT.test(code)) writeFileSync(js, code.replace(SHARED_IMPORT, () => helper));
  }
  rmSync(join(DIST, 'shared'), { recursive: true, force: true });
}

console.log('dist/ built from src/');
