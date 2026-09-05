import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Why: the doc-page syncers (CSS + JS) need the same escape-then-swap logic
 * for the inline <pre><code> source blocks; one implementation keeps both
 * scripts thin and their behavior guaranteed identical.
 */

/**
 * HTML-escapes a source file for embedding inside a <code> element.
 * The entity replacements are spelled with \u0026 (not a literal ampersand)
 * so they survive editors/tools that decode HTML entities in transit — an
 * earlier edit silently turned them into identity replacements, which
 * embedded raw `<`/`>`/`&` into every synced doc page and broke strict
 * HTML parsers (parse5 "invalid-first-character-of-tag-name").
 */
export function htmlEncode(str: string): string {
  return str
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;');
}

/**
 * True when `html` has a static <pre><code class="{langClass}"> block whose
 * content differs from the (HTML-escaped) source file. Pages using data-src
 * load the snippet dynamically and never drift. Shared by the syncers and
 * `verify` so the sync check is exactly the sync behavior.
 */
export function snippetDrifts(html: string, langClass: string, source: string): boolean {
  if (html.includes(`class="${langClass}" data-src=`)) return false;
  const regex = new RegExp(`(<pre><code class="${langClass}"[^>]*>)([\\s\\S]*?)(</code></pre>)`);
  const match = html.match(regex);
  return match !== null && match[2] !== htmlEncode(source.trimEnd());
}

/**
 * Replaces the first <pre><code class="{langClass}"> block in the page with
 * the source file's content. Writes only when the snippet actually drifted.
 */
export function syncFirstSnippet(
  htmlPath: string,
  langClass: string,
  sourcePath: string,
): 'updated' | 'skipped' {
  const html = readFileSync(htmlPath, 'utf8');
  if (!existsSync(sourcePath)) return 'skipped';
  if (!snippetDrifts(html, langClass, readFileSync(sourcePath, 'utf8'))) return 'skipped';

  const regex = new RegExp(`(<pre><code class="${langClass}"[^>]*>)([\\s\\S]*?)(</code></pre>)`);
  const encoded = htmlEncode(readFileSync(sourcePath, 'utf8').trimEnd());
  // MUST be a function replacer: a string replacement would interpret `$&`,
  // "$`" etc. in the encoded source (component comments contain backtick-$-backtick)
  writeFileSync(htmlPath, html.replace(regex, (_m, open, _old, close) => open + encoded + close), 'utf8');
  return 'updated';
}
