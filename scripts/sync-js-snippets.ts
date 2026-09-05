#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { syncFirstSnippet } from './lib/snippets.ts';

/**
 * Why: doc pages show each component's interaction JS in an inline
 * <pre><code> block; this re-embeds the real source after any edit. The
 * "view file" link names the shipped .js, but in src/ the file is .ts
 * (build emits the .js), so try the .ts sibling first — src is the truth.
 */

const DOCS_DIR = join(import.meta.dirname, '..', 'src', 'documentation');

let updated = 0;
let skipped = 0;
const errors: string[] = [];

for (const htmlFile of readdirSync(DOCS_DIR).filter((f) => f.endsWith('.html'))) {
  const htmlPath = join(DOCS_DIR, htmlFile);
  const html = readFileSync(htmlPath, 'utf8');

  const jsLink = html.match(
    /<a\s+href="(\.\.\/components\/[^"]+\.js)"\s+target="_blank"[^>]*>view file<\/a>/,
  )?.[1];
  if (!jsLink) continue;

  const jsPath = resolve(DOCS_DIR, jsLink);
  const sourcePath = existsSync(jsPath.replace(/\.js$/, '.ts'))
    ? jsPath.replace(/\.js$/, '.ts')
    : jsPath;
  if (!existsSync(sourcePath)) {
    errors.push(`${htmlFile}: JS file not found: ${jsPath}`);
    continue;
  }

  if (syncFirstSnippet(htmlPath, 'language-javascript', sourcePath) === 'updated') {
    updated++;
    console.log(`✓ ${htmlFile} → synced with ${basename(sourcePath)}`);
  } else {
    skipped++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (errors.length) process.exit(1);
