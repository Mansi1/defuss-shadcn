#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Why: the doc site hand-writes utility classes in css/docs-utilities.css;
 * this finds utility-shaped classes used in pages/components that are NOT
 * defined there (silent no-ops in the browser). Component-authored class names
 * are excluded. Exits non-zero if any component file uses an undefined
 * utility — doc pages are only reported. Port of the original Python audit.
 */

const ROOT = join(import.meta.dirname, '..');
const DOC_DIR = join(ROOT, 'src/documentation');
const COMP_DIR = join(ROOT, 'src/components');

/** Recursively collects files under `dir` matching `exts` (e.g. ['.html']). */
function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(path);
  }
  return out;
}

// classes defined in docs-utilities.css (top-level `.foo {` selectors)
const utilCss = readFileSync(join(DOC_DIR, 'css/docs-utilities.css'), 'utf8');
const defined = new Set<string>([
  ...[...utilCss.matchAll(/\n\.([a-z][a-z0-9-]*)\s*\{/g)].map((m) => m[1]),
  ...[...utilCss.matchAll(/^\.([a-z][a-z0-9-]*)\s*\{/gm)].map((m) => m[1]),
]);

// component-owned class names (from component CSS) are never "missing utilities"
const componentClasses = new Set<string>();
for (const css of walk(COMP_DIR, ['.css'])) {
  for (const m of readFileSync(css, 'utf8').matchAll(/\.([a-z][a-z0-9_-]*)/g)) {
    componentClasses.add(m[1]);
  }
}

// tailwind-ish names that *look* like our hand-rolled utilities
const TW = new RegExp(
  '^(?:' +
    [
      'm[trblxy]?-[0-9]+',
      'p[trblxy]?-[0-9]+',
      'gap(?:-[xy])?-[0-9]+',
      'space-[xy]-[0-9]+',
      'text-(?:xs|sm|base|lg|xl|[0-9]xl|left|center|right|justify|balance|pretty|muted-foreground|destructive|primary|secondary|accent|foreground|card|popover|sidebar|background)',
      'font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|mono|sans|serif)',
      'leading-(?:none|tight|snug|normal|relaxed|loose|[0-9]+)',
      'tracking-(?:tighter|tight|normal|wide|wider|widest)',
      'flex(?:-(?:row|col|wrap|nowrap|1|auto|initial|none|grow|shrink))?',
      'grid(?:-cols-[0-9]+|-rows-[0-9]+)?',
      'col-span-[0-9]+',
      'row-span-[0-9]+',
      'items-(?:start|center|end|baseline|stretch)',
      'justify-(?:start|center|end|between|around|evenly|items)',
      'self-(?:start|center|end|auto|stretch)',
      'place-(?:items|content|self)-[a-z]+',
      'content-(?:start|center|end|between|around|evenly)',
      'order-[0-9]+',
      'basis-[0-9a-z/]+',
      '(?:w|h|min-w|min-h|max-w|max-h|size)-[0-9a-z/]+',
      'bg-[a-z0-9-]+',
      'border(?:-[trbl]|-[0-9]|-[a-z]+)?',
      'rounded(?:-[a-z0-9]+)?',
      'shadow(?:-[a-z0-9]+)?',
      'ring(?:-[a-z0-9]+)?',
      'opacity-[0-9]+',
      'z-[0-9]+',
      'overflow-[a-z-]+',
      'cursor-[a-z-]+',
      'select-[a-z]+',
      'pointer-events-[a-z]+',
      '(?:uppercase|lowercase|capitalize|truncate|italic|underline|antialiased)',
      'whitespace-[a-z]+',
      'break-[a-z]+',
      'sr-only',
      'not-sr-only',
      '(?:inset|top|left|right|bottom)-[0-9a-z]+',
      '(?:scale|rotate|translate|skew)(?:-[xy])?-[0-9]+',
      'transform',
      'transition(?:-[a-z]+)?',
      'duration-[0-9]+',
      'ease-[a-z-]+',
      'delay-[0-9]+',
      'animate-[a-z-]+',
      'origin-[a-z-]+',
      'hidden|block|inline|inline-block|inline-flex|inline-grid',
      'absolute|relative|fixed|sticky|static',
      'object-[a-z-]+',
      'aspect-[a-z0-9/]+',
      'divide-[a-z0-9-]+',
      'm[xytrbl]-[0-9a-z]+', // mx/my/mt/mb/ml/mr
      'p[xytrbl]-[0-9a-z]+', // px/py/pt/pb/pl/pr
      '[a-z]+:[a-z]', // variant prefix e.g. md: hover:
    ].join('|') +
    ')$',
);

function scanFiles(paths: string[], label: string): number {
  const missing = new Map<string, string[]>();
  for (const f of paths) {
    const content = readFileSync(f, 'utf8');
    for (const m of content.matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(/\s+/)) {
        if (defined.has(c) || componentClasses.has(c) || !TW.test(c)) continue;
        if (!missing.has(c)) missing.set(c, []);
        missing.get(c)!.push(f);
      }
    }
  }
  console.log(`\n=== ${label} ===`);
  if (missing.size === 0) {
    console.log('  CLEAN — no undefined utility-shaped classes found');
    return 0;
  }
  for (const [c, files] of [...missing.entries()].sort()) {
    console.log(`  ${c}  (${files.length} occurrences)`);
    for (const p of [...new Set(files)].sort().slice(0, 3)) console.log(`    - ${relative(ROOT, p)}`);
  }
  return missing.size;
}

scanFiles(walk(DOC_DIR, ['.html']), 'DOC PAGES (any file)');
const compMissing = scanFiles(walk(COMP_DIR, ['.html', '.md']), 'COMPONENT FILES (must be clean)');

process.exit(compMissing === 0 ? 0 : 1);
