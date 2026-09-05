#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { syncFirstSnippet } from './lib/snippets.ts';

/**
 * Why: doc pages show each component's CSS in an inline <pre><code> block;
 * this re-embeds the real stylesheet after any edit so the displayed source
 * never drifts. Operates on src/ (the authoring tree) — dist/ is generated
 * and would be wiped by the next build.
 */

const DOCS_DIR = join(import.meta.dirname, '..', 'src', 'documentation');

let updated = 0;
let skipped = 0;
const errors: string[] = [];

for (const htmlFile of readdirSync(DOCS_DIR).filter((f) => f.endsWith('.html'))) {
  const htmlPath = join(DOCS_DIR, htmlFile);
  const html = readFileSync(htmlPath, 'utf8');

  // the "view file" link is the single source of truth for which file a page mirrors
  const cssLink = html.match(
    /<a\s+href="(\.\.\/components\/[^"]+\.css)"\s+target="_blank"[^>]*>view file<\/a>/,
  )?.[1];
  if (!cssLink) continue;

  const cssPath = resolve(DOCS_DIR, cssLink);
  if (!existsSync(cssPath)) {
    errors.push(`${htmlFile}: CSS file not found: ${cssPath}`);
    continue;
  }

  // language-scss is the standard class; language-css appears on pages that
  // also need an id="source-css" guard so general CSS demos aren't clobbered
  const status =
    syncFirstSnippet(htmlPath, 'language-scss', cssPath) === 'updated' ||
    (html.includes('id="source-css"') &&
      syncFirstSnippet(htmlPath, 'language-css', cssPath) === 'updated')
      ? 'updated'
      : 'skipped';

  if (status === 'updated') {
    updated++;
    console.log(`✓ ${htmlFile} → synced with ${basename(cssPath)}`);
  } else {
    skipped++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (errors.length) process.exit(1);
