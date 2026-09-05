import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Why: the doc-page syncers (CSS + JS) need the same escape-then-swap logic
 * for the inline <pre><code> source blocks; one implementation keeps both
 * scripts thin and their behavior guaranteed identical.
 */

/** HTML-escapes a source file for embedding inside a <code> element. */
export function htmlEncode(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
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
  const match = html.match(regex)!;
  writeFileSync(
    htmlPath,
    html.replace(regex, match[1] + htmlEncode(readFileSync(sourcePath, 'utf8').trimEnd()) + match[3]),
    'utf8',
  );
  return 'updated';
}
