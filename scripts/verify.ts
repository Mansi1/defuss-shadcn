#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseHTML } from 'linkedom';
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
// Order matters: the e2e fixture/assertions encode the component's documented
// surface (incl. State API states) — writing them before the source is
// refactored means rewriting the test afterwards. Source first, then e2e.
const missingE2e = componentDirs
  .filter((c) => !existsSync(join(E2E, `${c}.e2e.ts`)))
  .map((c) => `tests/e2e/${c}.e2e.ts missing`);
check(
  'e2e smoke tests',
  missingE2e,
  'per component: 1) refactor source to State API + docs/skill (see "state API" warning), 2) THEN add fixture + test per tests/e2e/accordion.e2e.{ts,fixture.html} template, 3) `bun run e2e`',
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
  'avatar', 'calendar', 'carousel', 'color-picker', 'combobox',
  'context-menu', 'image',
  'number-input', 'sidebar', 'slider', 'sortable',
  'toast', 'tree-view',
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
  // spell out the refactor directive when the states array itself is absent —
  // an agent reading only this line must know what to do (AGENTS.md "State API")
  const rest = missing.filter((m) => m !== 'states array declares default').join(', ');
  const line = missing.includes('states array declares default')
    ? `${name}: no ${name}States = ['default', …] declared — refactor this component to support at least the 'default' state following the State API architecture${rest ? ` (also missing: ${rest})` : ''}`
    : `${name}: missing ${missing.join(', ')}`;
  if (STATE_API_LEGACY.includes(name)) stateApiWarnings.push(line);
  else stateApiProblems.push(line);
}
check(
  'state API',
  stateApiProblems,
  `refactor each component above to the State API architecture: declare {name}States with "default" first, implement setState/getState/triggerStateChange, bind el.api (AGENTS.md "State API", copy accordion.ts); then drop migrated names from STATE_API_LEGACY in scripts/verify.ts`,
);
check(
  'state API (legacy rollout)',
  stateApiWarnings,
  'step 1 of the two-step rollout (SOURCE FIRST, e2e after): refactor each component to the State API (at least a "default" state, AGENTS.md "State API"), one component per commit, then drop it from STATE_API_LEGACY in scripts/verify.ts; afterwards its e2e fixture/test must cover every declared state',
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
  const e2e = existsSync(join(ROOT, 'tests', 'e2e', `${c}.e2e.ts`))
    ? readFileSync(join(ROOT, 'tests', 'e2e', `${c}.e2e.ts`), 'utf8')
    : '';

  for (const s of states) {
    if (s !== 'default' && MODES.some((m) => !existsSync(join(ROOT, 'screenshots', m, `${c}-${s}.png`)))) {
      coverageProblems.push(`${c}: no screenshot for state "${s}" (both modes) — add [data-state-demo] + run \`bun run screenshots\``);
    }
    if (!doc.includes(`<code>${s}</code>`)) coverageProblems.push(`${c}: state "${s}" not documented in ${c}.html (<code>${s}</code>)`);
    if (!skill.includes(s)) coverageProblems.push(`${c}: state "${s}" not listed in component-skill.md`);
    if (!e2e.includes(`'${s}'`)) coverageProblems.push(`${c}: state "${s}" not asserted in ${c}.e2e.ts`);
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

// 15. code ↔ skill ↔ docs parity: every variant/size IMPLEMENTED in the
// component CSS (data-variant/data-size selectors are the source of truth —
// the CSS ships what works) must be documented in BOTH the component skill
// and the doc page. Catches the classic drift: CSS gains a variant, docs and
// skill silently rot. A token counts as documented when it appears quoted
// ("x"), backticked (`x`), or as a table cell (| x |) — the forms the skill
// template and doc markup actually use.
const skillProblems: string[] = [];
for (const c of componentDirs) {
  const cssFile = join(COMPS, c, `${c}.css`);
  const docPage = join(DOCS, `${c}.html`);
  const skillFile = join(COMPS, c, 'component-skill.md');
  if (!existsSync(cssFile)) continue;
  const tokens = new Set(
    [...readFileSync(cssFile, 'utf8').matchAll(/data-(?:variant|size)="([a-z0-9-]+)"/g)].map((m) => m[1]),
  );
  if (tokens.size === 0) continue;
  const skillText = existsSync(skillFile) ? readFileSync(skillFile, 'utf8') : '';
  const doc = existsSync(docPage) ? readFileSync(docPage, 'utf8') : '';
  const documented = (text: string, t: string) =>
    text.includes(`"${t}"`) || text.includes(`\`${t}\``) || new RegExp(`\\|\\s*${t}\\s*\\|`).test(text);
  const missSkill = [...tokens].filter((t) => !documented(skillText, t));
  const missDoc = [...tokens].filter((t) => !doc.includes(t));
  if (missSkill.length)
    skillProblems.push(`${c}: CSS implements [${missSkill.join(', ')}] but component-skill.md doesn't document it`);
  if (missDoc.length) skillProblems.push(`${c}: CSS implements [${missDoc.join(', ')}] but ${c}.html doesn't show it`);
}
check(
  'skill ↔ docs parity',
  skillProblems,
  'update component-skill.md (Variants/Sizes tables) and the doc page to cover what the CSS implements (AGENTS.md)',
);

// 15b. strict type-check of the tooling/test trees (bun run typecheck). The
// e2e rollout is all test code — a type error must not survive to CI. ~0.3 s.
const typecheck = Bun.spawnSync({ cmd: ['bun', 'run', 'typecheck'], cwd: ROOT });
check(
  'typecheck',
  typecheck.exitCode === 0
    ? []
    : typecheck.stderr
        .toString()
        .split('\n')
        .filter((l) => /\w+\.\w+\(\d+,\d+\): error/.test(l))
        .slice(0, 8),
  'fix the type errors above (bun run typecheck prints full output)',
);

// 15c. docs/ mirror freshness: GitHub Pages publishes ./docs verbatim, so it
// must be byte-identical to the current dist/ (same tree sync-docs.ts writes).
const docsProblems: string[] = [];
const DOCS_OUT = join(ROOT, 'docs');
if (existsSync(DOCS_OUT) && existsSync(DIST)) {
  const tree = (dir: string): Map<string, string> =>
    new Map(
      walk(dir, [''])
        .filter((f) => !f.endsWith('.DS_Store'))
        .map((f) => [relative(dir, f), createHash('sha256').update(readFileSync(f)).digest('hex')]),
    );
  const distTree = tree(DIST);
  const docsTree = tree(DOCS_OUT);
  for (const [rel, hash] of distTree) {
    if (!docsTree.has(rel)) docsProblems.push(`docs/${rel} missing`);
    else if (docsTree.get(rel) !== hash) docsProblems.push(`docs/${rel} differs from dist/`);
  }
  for (const rel of docsTree.keys()) if (!distTree.has(rel)) docsProblems.push(`docs/${rel} is stale (not in dist/)`);
} else if (!existsSync(DOCS_OUT) && existsSync(DIST)) {
  docsProblems.push('docs/ missing — GitHub Pages would publish nothing');
}
check(
  'docs mirror fresh',
  docsProblems.slice(0, 8),
  'run `bun run docs` (re-builds dist/ and re-mirrors to docs/ for GitHub Pages)',
);

// 16. working tree cleanliness (warn): uncommitted changes make "green build"
// ambiguous — the agent must finish by committing so CI sees what was tested.
const gitProblems: string[] = [];
const gitStatus = Bun.spawnSync({ cmd: ['git', 'status', '--porcelain'], cwd: ROOT });
if (gitStatus.exitCode === 0) {
  const dirty = gitStatus.stdout.toString().trim().split('\n').filter(Boolean);
  if (dirty.length) {
    gitProblems.push(`${dirty.length} uncommitted change(s), e.g.: ${dirty.slice(0, 4).map((d) => d.slice(0, 40)).join(' | ')}`);
  }
} // no .git / git missing → check silently skips (tarball builds, CI without git)
check(
  'working tree committed',
  gitProblems,
  'commit the verified changes (git add -A && git commit) so CI and other agents see exactly what passed',
  true,
);

// 17. snippet escaping sentinel: an unescaped `<` inside <pre><code> breaks
// every strict HTML parser (parse5 "invalid-first-character-of-tag-name") —
// this bit us when htmlEncode silently degraded to identity replacements.
const escapeProblems: string[] = [];
for (const f of readdirSync(DOCS).filter((x) => x.endsWith('.html'))) {
  const html = readFileSync(join(DOCS, f), 'utf8');
  for (const m of html.matchAll(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)) {
    if (/<[a-zA-Z/!?]/.test(m[1])) escapeProblems.push(`${f}: unescaped tag inside <pre><code>`);
  }
}
check(
  'snippet escaping',
  escapeProblems,
  'raw < in a snippet means htmlEncode was bypassed — run `bun run sync-snippets` (never paste source into doc pages by hand)',
);

// 18. accessibility CSS promises (AGENTS.md "Accessibility CSS"): any
// component that animates must honor prefers-reduced-motion. Warn-ratchet:
// 16 legacy components predate the rule; accordion/dialog are the reference
// implementations and are held to it.
const REDUCED_MOTION_LEGACY = [
  'tooltip', 'calendar', 'progress', 'alert-dialog', 'skeleton', 'toast', 'number-input',
  'spinner', 'file-input', 'context-menu', 'date-picker', 'table', 'collapsible',
  'tree-view', 'select', 'sheet',
];
const motionProblems: string[] = [];
const motionWarnings: string[] = [];
for (const c of componentDirs) {
  const cssFile = join(COMPS, c, `${c}.css`);
  if (!existsSync(cssFile)) continue;
  const css = readFileSync(cssFile, 'utf8');
  if (!/(transition|animation)\s*:/.test(css)) continue;
  if (css.includes('prefers-reduced-motion')) continue;
  const line = `${c}: animates but has no @media (prefers-reduced-motion: reduce) block`;
  if (REDUCED_MOTION_LEGACY.includes(c)) motionWarnings.push(line);
  else motionProblems.push(line);
}
check(
  'reduced motion',
  motionProblems,
  'add an @media (prefers-reduced-motion: reduce) { @layer components { … } } block suppressing transitions (see accordion.css)',
);
check(
  'reduced motion (legacy rollout)',
  motionWarnings,
  'same as above, then drop the name from REDUCED_MOTION_LEGACY in scripts/verify.ts',
  true,
);

// 19. init idempotency contract (AGENTS.md): JS that attaches listeners must
// guard against double-initialization (:not([data-init]) or a global flag) and
// re-run init via MutationObserver, or SPA navigation double-binds handlers.
const INIT_GUARD_LEGACY: string[] = [];
const initProblems: string[] = [];
const initWarnings: string[] = [];
for (const c of componentDirs) {
  const tsFile = join(COMPS, c, `${c}.ts`);
  if (!existsSync(tsFile)) continue;
  const src = readFileSync(tsFile, 'utf8');
  if (!src.includes('addEventListener')) continue;
  const guarded = src.includes('data-init') || /document\.__\w+/.test(src);
  const reInits = src.includes('MutationObserver');
  if (guarded && reInits) continue;
  const line = `${c}: ${guarded ? '' : 'no :not([data-init]) guard'}${guarded && !reInits ? 'and ' : ''}${reInits ? '' : 'no MutationObserver re-init'}`;
  if (INIT_GUARD_LEGACY.includes(c)) initWarnings.push(line);
  else initProblems.push(line);
}
check(
  'init idempotency',
  initProblems,
  'guard listeners with :not([data-init]) + el.dataset.init (or document.__flag for delegation) and add `new MutationObserver(init).observe(…)` (AGENTS.md)',
);
check(
  'init idempotency (legacy rollout)',
  initWarnings,
  'same as above, then drop the name from INIT_GUARD_LEGACY in scripts/verify.ts',
  true,
);

// 20. doc/tooling reference integrity: commands quoted in AGENTS.md and
// README must exist — renaming a script or make target silently rots the docs
// that agents follow as instructions.
const pkgScripts = new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts));
const makeTargets = new Set(
  [...readFileSync(join(ROOT, 'Makefile'), 'utf8').matchAll(/^([a-z][a-z0-9_-]*):/gm)].map((m) => m[1]),
);
const refProblems: string[] = [];
for (const md of ['AGENTS.md', 'README.md']) {
  const text = readFileSync(join(ROOT, md), 'utf8');
  // only backtick-quoted commands count — prose like "make sure" must not match
  for (const m of text.matchAll(/`bun run ([a-z][a-z0-9:-]*)`/g)) {
    if (!pkgScripts.has(m[1])) refProblems.push(`${md}: "bun run ${m[1]}" is not a package.json script`);
  }
  for (const m of text.matchAll(/`make ([a-z][a-z0-9_-]*)`/g)) {
    if (!makeTargets.has(m[1])) refProblems.push(`${md}: "make ${m[1]}" is not a Makefile target`);
  }
}
check(
  'doc command refs',
  refProblems,
  'fix the doc reference or restore the script/target — docs are agent instructions',
);

// 21. link integrity in the shipped doc pages: every local href/src and
// same-page #anchor must resolve inside dist/. Snippet blocks are excluded —
// they contain escaped examples (src="photo.jpg") meant to be illustrative.
// checked against the SHIPPED tree (pages reference compiled .js). linkedom
// gives us the same view the browser has: contents of <pre>, <script> and
// <style> — including the raw skill markdown embedded in
// <script type="text/plain"> — are text, not elements, so illustrative
// markup there (src="photo.jpg") is never mistaken for a live link.
// Ceiling (ponytail): cross-page anchors (page.html#id) only check the page.
const linkProblems: string[] = [];
if (existsSync(DIST)) {
  for (const f of readdirSync(join(DIST, 'documentation')).filter((x) => x.endsWith('.html'))) {
    const { document } = parseHTML(readFileSync(join(DIST, 'documentation', f), 'utf8'));
    const ids = new Set([...document.querySelectorAll('[id]')].map((el) => el.getAttribute('id')));
    for (const el of document.querySelectorAll('[href],[src]')) {
      const url = (el.getAttribute(el.hasAttribute('href') ? 'href' : 'src') ?? '').trim();
      if (/^(https?:|mailto:|data:|javascript:)/i.test(url)) continue;
      // demo placeholders: no target at all, or the conventional "..." stub
      if (url === '' || url === '#' || url === '...') continue;
      if (url.startsWith('#')) {
        if (!ids.has(url.slice(1))) linkProblems.push(`${f}: dead anchor #${url.slice(1)}`);
        continue;
      }
      const [path] = url.split('#');
      if (!path) continue;
      if (!existsSync(join(DIST, 'documentation', path))) linkProblems.push(`${f}: dead link ${url}`);
    }
  }
}
check(
  'doc link integrity',
  linkProblems,
  'fix or remove the link (dead links on the published docs site are user-facing breakage)',
);

// 22. fixture ↔ CSS parity: every variant/size the component CSS implements
// must be instantiated in its e2e fixture (docs parity rule, mechanical side).
const fixtureProblems: string[] = [];
for (const c of componentDirs) {
  const cssFile = join(COMPS, c, `${c}.css`);
  const fixture = join(ROOT, 'tests', 'e2e', `${c}.e2e-fixture.html`);
  if (!existsSync(cssFile) || !existsSync(fixture)) continue; // missing fixture = check 3
  const tokens = new Set(
    [...readFileSync(cssFile, 'utf8').matchAll(/data-(?:variant|size)="([a-z0-9-]+)"/g)].map((m) => m[1]),
  );
  const fx = readFileSync(fixture, 'utf8');
  const missing = [...tokens].filter((t) => !fx.includes(`"${t}"`));
  if (missing.length) fixtureProblems.push(`${c}: fixture lacks [${missing.join(', ')}]`);
}
check(
  'fixture ↔ CSS parity',
  fixtureProblems,
  'instantiate every documented variant/size in the e2e fixture (AGENTS.md "Docs ↔ E2E parity")',
);

// 23. portability: no machine-specific absolute paths anywhere in the repo
// sources/scripts/tests (repo rule — these paths break on other systems).
const pathProblems: string[] = [];
for (const f of [...walk(SRC, ['']), ...walk(join(ROOT, 'scripts'), ['']), ...walk(join(ROOT, 'tests'), [''])]) {
  if (/\.(woff2?|png|ico|jpg|jpeg|gif|webp)$/.test(f)) continue;
  const hit = readFileSync(f, 'utf8').match(/\/Users\/[a-z]+|[A-Z]:\\|file:\/\/\//);
  if (hit) pathProblems.push(`${relative(ROOT, f)}: ${hit[0]}`);
}
check(
  'portable paths',
  pathProblems,
  'use paths relative to the repo root (import.meta.dirname / relative joins)',
);

// 24. render drift (warn): a PNG whose bytes changed since capture while its
// component's inputs did NOT means something outside the repo altered the
// render (CDN asset, font, browser version) — worth a human/agent look.
const driftProblems: string[] = [];
const driftManifestPath = join(ROOT, 'screenshots', 'manifest.json');
if (existsSync(driftManifestPath) && existsSync(DIST)) {
  const dm = JSON.parse(readFileSync(driftManifestPath, 'utf8')) as {
    fingerprints?: Record<string, string>;
    renders?: Record<string, string>;
  };
  const nowFp = componentFingerprints(DIST);
  for (const [c, fp] of Object.entries(dm.fingerprints ?? {})) {
    if (nowFp[c] !== fp) continue; // inputs changed → the diff is expected
    for (const [key, hash] of Object.entries(dm.renders ?? {})) {
      // keys look like "light/button.png" or "dark/accordion-all-open.png"
      const file = key.slice(key.indexOf('/') + 1).replace(/\.png$/, '');
      if (file !== c && !file.startsWith(`${c}-`)) continue;
      const png = join(ROOT, 'screenshots', key);
      if (!existsSync(png)) continue;
      const actual = createHash('sha256').update(readFileSync(png)).digest('hex').slice(0, 16);
      if (actual !== hash) driftProblems.push(`screenshots/${key} changed pixels without any input changing`);
    }
  }
}
check(
  'render drift',
  driftProblems,
  'inspect the PNG against the component (external asset/browser change?) — or recapture with `bun run screenshots --force` once intentional',
  true,
);

console.log(
  failed
    ? `\nverify: FAILED (${failed} check group(s), ${warned} warning group(s))`
    : `\nverify: OK${warned ? ` (${warned} warning group(s))` : ''}`,
);
process.exit(failed ? 1 : 0);
