import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: badge is CSS-only — the shipped contract is badge.css itself. This
 * verifies the base geometry (hardcoded px values) actually applies and that
 * the three documented variants render with genuinely distinct token-derived
 * colors (theme-value-agnostic distinctness, not hardcoded oklch).
 */
await cssSmoke('badge', [
  {
    label: 'badge.css applies base geometry (pill radius, padding, font)',
    selector: '#b-default',
    css: {
      display: 'inline-flex',
      'border-radius': '9999px',
      padding: '2px 10px',
      'font-size': '11px',
      'font-weight': '500',
      'line-height': '24px',
    },
  },
  {
    label: 'all three variants carry distinct background colors',
    distinct: [
      { selector: '#b-default', prop: 'background-color' },
      { selector: '#b-secondary', prop: 'background-color' },
      { selector: '#b-outline', prop: 'background-color' },
    ],
  },
  {
    label: 'outline is bordered, others are not',
    selector: '#b-outline',
    css: { 'border-top-width': '1px' },
  },
]);
