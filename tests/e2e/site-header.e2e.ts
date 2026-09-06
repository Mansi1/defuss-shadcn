import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: site-header is CSS-only — the contract is that the flex header lays
 * out brand/nav/actions, the container query reveals the nav at wide
 * containers, and the sticky variant actually sticks.
 */
await cssSmoke('site-header', [
  {
    label: 'inner row is a space-between flex bar, 56px min height',
    selector: '.mk-header-inner',
    css: { display: 'flex', 'justify-content': 'space-between', 'min-height': '56px' },
  },
  {
    label: 'brand icon is 20px and name uses primary color (≠ header bg)',
    distinct: [
      { selector: '.mk-header-name', prop: 'color' },
      { selector: '.mk-header', prop: 'background-color' },
    ],
  },
  {
    label: 'nav is visible at fixture width (container ≥ 30rem)',
    selector: '.mk-header-nav',
    css: { display: 'flex' },
  },
  {
    label: 'nav link is a 32px pill',
    selector: '.mk-header-link',
    css: { height: '32px', 'font-size': '14px', 'font-weight': '500' },
  },
  {
    label: 'data-variant="sticky" pins the header',
    selector: '.mk-header[data-variant="sticky"]',
    css: { position: 'sticky', top: '0px' },
  },
]);
