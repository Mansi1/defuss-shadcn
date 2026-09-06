import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: breadcrumb is CSS-only — verify the list resets to a flex row with
 * exact gaps/size, the ellipsis reserves a square hit area, and the current
 * page renders as foreground text (not a muted link).
 */
await cssSmoke('breadcrumb', [
  {
    label: '.breadcrumb-list is a flex row with 6px gaps, no list marker',
    selector: '.breadcrumb-list',
    css: { display: 'flex', gap: '6px', 'list-style-type': 'none', 'font-size': '14px', padding: '0px' },
  },
  {
    label: '.breadcrumb-separator is smaller (12px) muted text',
    selector: '.breadcrumb-separator',
    css: { 'font-size': '12px' },
  },
  {
    label: '.breadcrumb-ellipsis is a 24px centered square',
    selector: '.breadcrumb-ellipsis',
    css: { display: 'flex', width: '24px', height: '24px', 'justify-content': 'center' },
  },
  {
    label: 'current page is foreground, links are muted (distinct colors)',
    distinct: [
      { selector: '.breadcrumb-link', prop: 'color' },
      { selector: '.breadcrumb-page', prop: 'color' },
    ],
  },
]);
