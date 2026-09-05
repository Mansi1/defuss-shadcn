#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { auditUtilities, walk } from './lib/audit.ts';
import { htmlEncode, snippetDrifts } from './lib/snippets.ts';

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

// 5. component files never rely on undefined doc-site utility classes
const { compIssues } = auditUtilities(ROOT);
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

// 11. version is consistent between package.json and the site header pill
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
const headerLayout = readFileSync(join(DOCS, 'js/layout.ts'), 'utf8');
check(
  'version consistency',
  headerLayout.includes(`v${version}`) ? [] : [`js/layout.ts has no "v${version}" pill`],
  'bump both together (deploy.sh does this) — or sync the pill manually',
);

// 12. changelog injection marker survived edits
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
