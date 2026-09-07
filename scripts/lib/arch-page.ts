import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Why: ARCH.md is the repo's design manifesto, but it only lives in the
 * repository — contributors browsing the docs site never see it. The
 * published Overview page must say EXACTLY what ARCH.md says, so the page
 * is generated from ARCH.md on every build (same class of artifact as
 * SKILL.md and the search index) and verify's drift gate fails when the two
 * diverge. Handles the small markdown subset ARCH.md uses: headings,
 * paragraphs, bullets (incl. wrapped continuation lines), ordered lists,
 * tables, fenced code, links, **bold**, *italic*, `code`.
 */

const REPO_FILE_BASE = 'https://github.com/kyr0/defuss-shadcn/blob/main/';
export const ARCH_TEMPLATE_FILE = 'architecture_tpl.html';
export const ARCH_OUTPUT_FILE = 'architecture.html';

/** TOC-compatible id, same slug rule as scripts/lib/search-index.ts. */
const slug = (text: string) =>
  'toc-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** escape just what text nodes need (quotes would double-encode visually) */
const esc = (s: string) => s.replace(/&/g, '\u0026amp;').replace(/</g, '\u0026lt;').replace(/>/g, '\u0026gt;');

/** inline markdown → HTML. Input is raw text; output is escaped HTML. */
function inline(s: string): string {
  const codes: string[] = [];
  // code spans are held as placeholders first so *, ** and [] inside them stay literal
  let out = esc(s).replace(/`([^`]+)`/g, (_m, c) => `\u0000${codes.push(`<code>${c}</code>`) - 1}\u0000`);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // may wrap *italic*
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // [text](url): repo-relative link targets point at the GitHub source
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const href = /^(https?:|mailto:|#)/.test(url) ? url : REPO_FILE_BASE + url.replace(/^\.?\//, '');
    return `<a href="${href}">${text}</a>`;
  });
  for (let i = 0; i < codes.length; i++) out = out.replaceAll(`\u0000${i}\u0000`, codes[i]);
  return out;
}

/** ARCH.md → the <main> body HTML (excluding the page shell). */
export function archBodyHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let listOrdered = false;
  const flushPara = () => {
    if (para.length) out.push(`<p class="text-muted-foreground leading-relaxed">${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      const tag = listOrdered ? 'ol' : 'ul';
      const cls = listOrdered ? '' : ' class="docs-ul"';
      out.push(`<${tag}${cls}>\n${list.map((i) => `  <li>${inline(i)}</li>`).join('\n')}\n</${tag}>`);
      list = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushPara();
      flushList();
      const lang = fence[1] || 'text';
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      // the mermaid flowchart renders as its source text — no runtime needed
      out.push(`<pre><code class="language-${lang}">${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const head = line.match(/^(#{1,3}) (.+)$/);
    if (head) {
      flushPara();
      flushList();
      // the page already carries its own h1; ARCH's # title is skipped, ## → h2, ### → h3
      if (head[1].length >= 2) {
        const level = head[1].length === 2 ? 'h2' : 'h3';
        const open = level === 'h2' ? ' id="' + slug(head[2]) + '"' : '';
        out.push(`<${level}${open}>${inline(head[2])}</${level}>`);
      }
      continue;
    }
    if (/^---\s*$/.test(line)) {
      flushPara();
      flushList();
      out.push('<hr class="separator" />');
      continue;
    }
    if (/^\|/.test(line)) {
      flushPara();
      flushList();
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells); // skip |---| separator
        i++;
      }
      i--;
      const [headRow, ...bodyRows] = rows;
      out.push(
        `<div style="overflow-x:auto;"><table class="table">\n` +
          `  <thead><tr>${headRow.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>\n` +
          bodyRows.map((r) => `  <tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n') +
          `\n</table></div>`,
      );
      continue;
    }
    const bullet = line.match(/^- (.+)$/) ?? line.match(/^\d+\. (.+)$/);
    if (bullet) {
      flushPara();
      const ordered = /^\d/.test(line);
      if (list.length && listOrdered !== ordered) flushList(); // ul ↔ ol switch
      listOrdered = ordered;
      list.push(bullet[1]);
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      if (list.length) {
        // loose list: blank lines between items keep the list open
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        const next = lines[j] ?? '';
        const nextItem = /^- .+$/.test(next) || /^\d+\. .+$/.test(next);
        if (!(nextItem && /^\d/.test(next) === listOrdered)) flushList();
      }
      continue;
    }
    if (list.length) {
      // markdown lazy continuation: a list item wrapped over multiple lines
      list[list.length - 1] += ' ' + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('\n');
}

/** Why: the full page = shell template + ARCH.md body; pure function of src/
 * so build.ts writes it and verify.ts compares it against the same truth. */
export function buildArchPageText(src: string): string {
  const md = readFileSync(join(src, '..', 'ARCH.md'), 'utf8');
  const tpl = readFileSync(join(src, ARCH_TEMPLATE_FILE), 'utf8');
  if (!tpl.includes('<!-- ARCH_BODY -->')) throw new Error(`${ARCH_TEMPLATE_FILE}: missing <!-- ARCH_BODY --> placeholder`);
  return tpl.replace('<!-- ARCH_BODY -->', `<div class="arch-prose">\n${archBodyHtml(md.trim())}\n</div>`);
}
