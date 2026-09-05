#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { auditUtilities, walk } from './lib/audit.ts';
import { componentFingerprints, declaredStates } from './lib/inputs.ts';
import { snippetDrifts } from './lib/snippets.ts';

/**
 * Why: one static, fast gate that proves the repo is self-consistent after any
 * change — run automatically at the end of `bun run build`. Every check names
 * the offending file and the fix. Failures exit 1; ⚠ warnings (known gaps,
 * e.g. not every component has an e2e test yet) report but don't fail.
 */

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const DOCS = join(SRC, 'documentation');
const COMPS = join(SRC, 'components');
const E2E = join(ROOT, 'tests/e2e');

let failed = 0;
let warned = 0;

function check(name: string, problems: string[], fix: string, warnOnly = false): void {
  if (problems.length === 0) {
    console.log(`  ✓ ${name}`);
    return;
  }
  if (warnOnly) {
    warned++;
    console.log(`  ⚠ ${name} (${problems.length})`);
  } else {
    failed++;
    console.log(`  ✗ ${name} (${problems.length})`);
  }
  for (const p of problems.slice(0, 5)) console.log(`      ${p}`);
  if (problems.length > 5) console.log(`      … and ${problems.length - 5} more`);
  console.log(`      fix: ${fix}`);
}

const componentDirs = readdirSync(COMPS).filter((d) => statSync(join(COMPS, d)).isDirectory());
/** Both color schemes create-screenshots.ts captures; state PNGs need both. */
const MODES = ['light', 'dark'];
const docPages = readdirSync(DOCS).filter((f) => f.endsWith('.html'));

// 1. every component folder ships a component skill
check(
  'component skills',
  componentDirs.filter((c) => !existsSync(join(COMPS, c, 'component-skill.md'))).map((c) => `src/components/${c}/component-skill.md missing`),
  'write the skill (see AGENTS.md "Component skill template")',
);

// 2. every component has a documentation page
check(
  'documentation pages',
  componentDirs.filter((c) => !docPages.includes(`${c}.html`)).map((c) => `src/documentation/${c}.html missing`),
  `copy src/documentation/badge.html as template`,
);

// 3. every component has an e2e smoke test (warn: rollout in progress)
const missingE2e = componentDirs
  .filter((c) => !existsSync(join(E2E, `${c}.e2e.mjs`)))
  .map((c) => `tests/e2e/${c}.e2e.mjs missing`);
check(
  'e2e smoke tests',
  missingE2e,
  'add fixture + test per tests/e2e/accordion.e2e.{mjs,fixture.html} template, then `bun run e2e`',
  true,
);

// 4. component CSS uses only defined tokens (tweakcn shape) or local defs
const tokenFile = readFileSync(join(SRC, 'theme/default-semantic-tokens.css'), 'utf8');
const globalTokens = new Set([...tokenFile.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const tokenProblems: string[] = [];
for (const css of walk(COMPS, ['.css'])) {
  const content = readFileSync(css, 'utf8');
  const local = new Set([...content.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  for (const m of content.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    if (!globalTokens.has(m[1]) && !local.has(m[1])) {
      tokenProblems.push(`${relative(ROOT, css)} uses undefined ${m[1]}`);
    }
  }
}
check(
  'design tokens',
  tokenProblems,
  'use an existing token from theme/default-semantic-tokens.css or a literal value (no new tokens)',
);

// 5. no undefined utility-shaped classes (components = hard gate, doc pages = info)
const { docIssues, compIssues } = auditUtilities(ROOT);
check(
  'utility classes (doc pages)',
  docIssues,
  'define the class in documentation/css/docs-utilities.css',
  true,
);
check(
  'utility classes (components)',
  compIssues,
  'define the class in documentation/css/docs-utilities.css or replace with component CSS',
);

// 6. inline CSS/JS snippets on doc pages match their source files
const docHtml = docPages.map((p) => [p, readFileSync(join(DOCS, p), 'utf8')] as const);
const snippetProblems: string[] = [];
for (const [page, html] of docHtml) {
  const cssLink = html.match(/<a\s+href="(\.\.\/components\/[^"]+\.css)"[^>]*>view file<\/a>/)?.[1];
  if (cssLink) {
    const cssPath = join(DOCS, cssLink);
    if (existsSync(cssPath) && snippetDrifts(html, 'language-scss', readFileSync(cssPath, 'utf8'))) {
      snippetProblems.push(`${page} — CSS snippet out of date vs ${cssLink}`);
    }
  }
  const jsLink = html.match(/<a\s+href="(\.\.\/components\/[^"]+\.js)"[^>]*>view file<\/a>/)?.[1];
  if (jsLink) {
    const jsPath = join(DOCS, jsLink);
    const src = existsSync(jsPath.replace(/\.js$/, '.ts')) ? jsPath.replace(/\.js$/, '.ts') : jsPath;
    if (existsSync(src) && snippetDrifts(html, 'language-javascript', readFileSync(src, 'utf8'))) {
      snippetProblems.push(`${page} — JS snippet out of date vs ${relative(DOCS, src)}`);
    }
  }
}
check(
  'snippet sync',
  snippetProblems,
  'run `bun run sync-snippets`',
);

// 7. every doc page imports every component's CSS and JS (cross-page demos)
const importProblems: string[] = [];
for (const [page, html] of docHtml) {
  for (const c of componentDirs) {
    if (!html.includes(`../components/${c}/${c}.css`)) importProblems.push(`${page} missing ${c}.css link`);
    if (
      (existsSync(join(COMPS, c, `${c}.ts`)) || existsSync(join(COMPS, c, `${c}.js`))) &&
      !html.includes(`../components/${c}/${c}.js`)
    ) {
      importProblems.push(`${page} missing ${c}.js import`);
    }
  }
}
check(
  'cross-page imports',
  importProblems,
  'add the missing <link>/<script> tags to the page (all pages import all components)',
);

// 8. every doc page is reachable from the sidebar (layout.ts NAV/BUILT)
const layout = readFileSync(join(DOCS, 'js/layout.ts'), 'utf8');
check(
  'sidebar coverage',
  docPages.filter((p) => !layout.includes(`'${p}'`)).map((p) => `${p} not referenced in js/layout.ts`),
  "add the page to the NAV array (and BUILT set if real) in js/layout.ts",
);

// 9. oxlint clean (oxlint exits non-zero only on errors — warnings pass by policy)
const lint = Bun.spawnSync({ cmd: ['bunx', 'oxlint', 'src', 'tests', 'scripts'], cwd: ROOT, stdout: 'pipe' });
check(
  'lint',
  lint.exitCode !== 0
    ? [new TextDecoder().decode(lint.stdout).split('\n').find((l) => /Found \d+/.test(l)) ?? 'oxlint failed to run']
    : [],
  'fix errors per AGENTS.md "Linting" (unused vars → _ prefix)',
);

// 10. dist/ is a fresh 1:1 mirror of src/ (types stripped, everything else copied)
const distProblems: string[] = [];
if (!existsSync(DIST)) {
  distProblems.push('dist/ does not exist — run `bun run build`');
} else {
  for (const f of walk(SRC, [''])) {
    const rel = relative(SRC, f);
    // ambient type declarations compile nothing and ship nothing; src/shared
    // is a build-time-only helper (inlined into dist component .js files)
    if (rel.endsWith('.d.ts') || rel.startsWith(`shared${sep}`)) continue;
    if (rel.endsWith('.ts')) {
      const js = join(DIST, rel.replace(/\.ts$/, '.js'));
      if (!existsSync(js)) distProblems.push(`dist/${relative(SRC, f).replace(/\.ts$/, '.js')} missing — rebuild`);
      else if (readFileSync(js, 'utf8').trim() === '') distProblems.push(`dist/${relative(SRC, rel)} is empty — rebuild`);
    } else {
      const mirror = join(DIST, rel);
      if (!existsSync(mirror)) distProblems.push(`dist/${rel} missing — rebuild`);
      else if(!readFileSync(mirror).equals(readFileSync(f))) distProblems.push(`dist/${rel} differs from src — rebuild`);
    }
  }
  const srcSet = new Set(walk(SRC, ['']).map((f) => relative(SRC, f).replace(/\.ts$/, '.js')));
  for (const f of walk(DIST, [''])) {
    const rel = relative(DIST, f);
    if (!srcSet.has(rel)) distProblems.push(`dist/${rel} is orphaned (no src/ counterpart) — rebuild`);
  }
}
check(
  'dist 1:1',
  distProblems,
  'run `bun run build` (never edit dist/ directly)',
);

// 10b. State API contract (AGENTS.md "State API"): every JS component must
// expose the global preamble + a declared default state + a bound per-element
// api. Ratchet rollout: components listed in STATE_API_LEGACY predate the
// contract and only warn — remove a name from the list as it is migrated, and
// every NEW JS component must satisfy the contract from day one.
const STATE_API_LEGACY = [
  'alert-dialog', 'avatar', 'calendar', 'carousel', 'color-picker', 'combobox',
  'command', 'context-menu', 'dropdown', 'image', 'navigation-menu',
  'number-input', 'popover', 'sheet', 'sidebar', 'slider', 'sortable', 'tabs',
  'toast', 'toggle', 'toggle-group', 'toolbar', 'tooltip', 'tree-view',
];
const STATE_API_PATTERNS: Array<[string, RegExp]> = [
  // preamble comes from the shared helper (build inlines it into dist .js);
  // inline globals still accepted so hand-rolled/legacy styles pass too
  ['defussGlobals() preamble', /(defussGlobals\(\)|globalThis\._defussShadcn\s*=)/],
  ['registry api assignment', /(_defussShadcn|defussGlobals\(\))\.\w+Api\s*=/],
  ['registry states assignment', /(_defussShadcn|defussGlobals\(\))\.\w+States\s*=/],
  ['states array declares default', /\w+States\s*=\s*\[[^\]]*['"]default['"]/],
  ['setState implementation', /\bsetState\s*\(/],
  ['getState implementation', /\bgetState\s*\(/],
  ['triggerStateChange implementation', /\btriggerStateChange\b/],
];
const stateApiProblems: string[] = [];
const stateApiWarnings: string[] = [];
for (const name of componentDirs) {
  const jsFile = join(COMPS, name, `${name}.ts`);
  if (!existsSync(jsFile)) continue;
  const src = readFileSync(jsFile, 'utf8');
  const missing = STATE_API_PATTERNS.filter(([, re]) => !re.test(src)).map(([label]) => label);
  if (missing.length === 0) continue;
  const line = `${name}: missing ${missing.join(', ')}`;
  if (STATE_API_LEGACY.includes(name)) stateApiWarnings.push(line);
  else stateApiProblems.push(line);
}
check(
  'state API',
  stateApiProblems,
  'add the State API preamble + states + bound api (AGENTS.md "State API", copy accordion.ts)',
);
check(
  'state API (legacy rollout)',
  stateApiWarnings,
  'migrate these components one by one, then drop them from STATE_API_LEGACY in scripts/verify.ts',
  true,
);

// 10c. shipped JS must contain the inlined preamble: every component whose
// src/ .ts uses defussGlobals() must ship a .js that CALLS it — build.ts is
// responsible for the inlining; if someone edits dist/ or breaks the build
// post-pass, the registry globals silently vanish at runtime.
const inlineProblems: string[] = [];
for (const name of componentDirs) {
  const tsFile = join(COMPS, name, `${name}.ts`);
  if (!existsSync(tsFile) || !readFileSync(tsFile, 'utf8').includes('defussGlobals()')) continue;
  const distJs = join(DIST, 'components', name, `${name}.js`);
  if (!existsSync(distJs)) continue; // already reported by dist 1:1
  const shipped = readFileSync(distJs, 'utf8');
  if (!shipped.includes('defussGlobals()')) {
    inlineProblems.push(`${name}.js missing defussGlobals() call — run \`bun run build\` or add the import in src`);
  } else if (shipped.includes('_shared/state-api') || shipped.includes('../../shared/')) {
    inlineProblems.push(`${name}.js still imports _shared — build post-pass failed to inline`);
  }
}
check(
  'inlined preamble (dist)',
  inlineProblems,
  'run `bun run build`; never edit dist/ directly',
);

// 11. every component doc page exposes a default-state .preview block — the
//     contract create-screenshots.ts (and the agent's eye) relies on
const previewProblems: string[] = [];
for (const c of componentDirs) {
  const page = join(DOCS, `${c}.html`);
  if (existsSync(page) && !readFileSync(page, 'utf8').includes('class="preview"')) {
    previewProblems.push(`src/documentation/${c}.html has no .preview block`);
  }
}
check(
  'preview blocks',
  previewProblems,
  'wrap the default demo in <div class="preview">…</div> (see badge.html)',
);

// 12. every component has light + dark screenshots whose manifest fingerprint
// matches the CURRENT dist/ inputs (same content-hash contract as
// create-screenshots.ts). Content-based, so a no-change rebuild stays green
// and any component edit invalidates exactly its own shots.
const shotProblems: string[] = [];
if (existsSync(DIST)) {
  const manifestPath = join(ROOT, 'screenshots', 'manifest.json');
  const manifest: { fingerprints?: Record<string, string> } = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {};
  const current = componentFingerprints(DIST);
  for (const c of componentDirs) {
    for (const mode of ['light', 'dark']) {
      if (!existsSync(join(ROOT, 'screenshots', mode, `${c}.png`))) {
        shotProblems.push(`screenshots/${mode}/${c}.png missing`);
      }
    }
    if (manifest.fingerprints?.[c] !== current[c]) {
      shotProblems.push(`screenshots of ${c} are stale vs dist/ (manifest mismatch)`);
    }
  }
}
check(
  'screenshots',
  shotProblems,
  'run `bun run screenshots` (incremental — re-shoots only components changed since the manifest)',
);

// 12b. every declared state of every JS component must be covered by ALL
// four artifacts (AGENTS.md "State API" rule 7): screenshot per mode, doc
// page (States section + data-state-demo anchor), component skill, e2e test.
const coverageProblems: string[] = [];
for (const c of componentDirs) {
  const tsFile = join(COMPS, c, `${c}.ts`);
  if (!existsSync(tsFile)) continue;
  const states = declaredStates(readFileSync(tsFile, 'utf8'));
  if (states.length === 0) continue;

  const doc = existsSync(join(DOCS, `${c}.html`)) ? readFileSync(join(DOCS, `${c}.html`), 'utf8') : '';
  if (!doc.includes('data-state-demo')) coverageProblems.push(`${c}: doc page lacks a [data-state-demo] anchor for state capture`);

  const skill = existsSync(join(COMPS, c, 'component-skill.md'))
    ? readFileSync(join(COMPS, c, 'component-skill.md'), 'utf8')
    : '';
  const e2e = existsSync(join(ROOT, 'tests', 'e2e', `${c}.e2e.mjs`))
    ? readFileSync(join(ROOT, 'tests', 'e2e', `${c}.e2e.mjs`), 'utf8')
    : '';

  for (const s of states) {
    if (s !== 'default' && MODES.some((m) => !existsSync(join(ROOT, 'screenshots', m, `${c}-${s}.png`)))) {
      coverageProblems.push(`${c}: no screenshot for state "${s}" (both modes) — add [data-state-demo] + run \`bun run screenshots\``);
    }
    if (!doc.includes(`<code>${s}</code>`)) coverageProblems.push(`${c}: state "${s}" not documented in ${c}.html (<code>${s}</code>)`);
    if (!skill.includes(s)) coverageProblems.push(`${c}: state "${s}" not listed in component-skill.md`);
    if (!e2e.includes(`'${s}'`)) coverageProblems.push(`${c}: state "${s}" not asserted in ${c}.e2e.mjs`);
  }
}
check(
  'state coverage',
  coverageProblems,
  'each declared state needs screenshots (both modes), doc page, skill and e2e coverage (AGENTS.md "State API" rule 7)',
);

// 13. version is consistent between package.json and the site header pill
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
const headerLayout = readFileSync(join(DOCS, 'js/layout.ts'), 'utf8');
check(
  'version consistency',
  headerLayout.includes(`v${version}`) ? [] : [`js/layout.ts has no "v${version}" pill`],
  'bump both together (deploy.sh does this) — or sync the pill manually',
);

// 14. changelog injection marker survived edits
check(
  'changelog marker',
  readFileSync(join(DOCS, 'changelog.html'), 'utf8').includes('<!-- CHANGELOG_ENTRIES -->')
    ? []
    : ['marker "<!-- CHANGELOG_ENTRIES -->" removed from changelog.html'],
  'restore the marker or deploy.sh cannot add entries',
);

console.log(
  failed
    ? `\nverify: FAILED (${failed} check group(s), ${warned} warning group(s))`
    : `\nverify: OK${warned ? ` (${warned} warning group(s))` : ''}`,
);
process.exit(failed ? 1 : 0);
