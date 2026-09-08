/**
 * Why: every component carries exactly one atomic-design type (ATM | MOL | ORG |
 * BLK | TPL) that must stay identical in three artifacts — the sidebar badge,
 * the skill frontmatter, and the doc page badge. This module is the single
 * source of truth (fs-free so scripts and tests share it): the allowed set and
 * the pure doc-page injection used identically by the bootstrap script and
 * verify's drift gate. Badge colors (taxonomy spec: cyan/blue/violet/amber/
 * slate + dark variants) live in documentation/css/layout.css as
 * `.type-badge[data-type=…]` rules — markup stays class-only, one place to recolor.
 */

/** Allowed types (taxonomy: Atom, Molecule, Organism, Block, Template). */
export const COMPONENT_TYPES = ['ATM', 'MOL', 'ORG', 'BLK', 'TPL'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

/** Human-readable names, used in badge tooltips. */
export const TYPE_NAMES: Record<ComponentType, string> = {
  ATM: 'Atom',
  MOL: 'Molecule',
  ORG: 'Organism',
  BLK: 'Block',
  TPL: 'Template',
};

/** Why: badge markup is generated (never hand-written) so the exact string is
 * byte-stable and greppable — layout.ts (sidebar) and every doc page embed this
 * identical markup, and verify's `Component doc page type badge` gate compares
 * it per page against the skill frontmatter. All visual styling (the taxonomy
 * colors, light + dark) lives in documentation/css/layout.css, keyed by
 * `.type-badge[data-type]`. */
export function typeBadgeHtml(type: ComponentType): string {
  return `<span class="type-badge" data-type="${type}" title="${TYPE_NAMES[type]}">${type}</span>`;
}

/** Why: the exact div the badge is injected after on every doc page (the
 * page-header metadata row) — shared between the bootstrap script and verify so
 * they anchor identically. */
export const BADGE_ANCHOR = '<div style="display:flex;align-items:baseline;gap:0.375rem;">';

/**
 * Why: place the type badge as the first chip of a doc page's page-header
 * metadata row (every component page has it). Idempotent: re-running with a new
 * type replaces the previous badge. Throws on an unknown type or a page without
 * the row (which would silently produce an unanchored injection).
 */
export function injectTypeBadge(html: string, type: ComponentType): string {
  if (!(COMPONENT_TYPES as readonly string[]).includes(type))
    throw new Error(`unknown component type "${type}" (allowed: ${COMPONENT_TYPES.join(', ')})`);
  const at = html.indexOf(BADGE_ANCHOR);
  if (at === -1) throw new Error('doc page has no page-header pill row to anchor the type badge');
  const tail = html.slice(at + BADGE_ANCHOR.length);
  const old = tail.match(/<span class="type-badge" data-type="[A-Z]{3}">[A-Z]{3}<\/span> /);
  return html.slice(0, at + BADGE_ANCHOR.length) + typeBadgeHtml(type) + ' ' + tail.replace(old ? old[0] : '', '');
}
