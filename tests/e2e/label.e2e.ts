import assert from 'node:assert/strict';
import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: label is CSS-only — geometry is literal; the dimming states are the
 * interesting part: [data-disabled] and the pure-CSS :has(+ :disabled)
 * sibling rule must both yield 0.7 opacity without any JS.
 */
await cssSmoke('label', [
  {
    label: '.label is block 14px/500 with 6px bottom margin',
    selector: '#lb-plain',
    css: { display: 'block', 'font-size': '14px', 'font-weight': '500', 'margin-bottom': '6px', 'line-height': '14px' },
  },
  {
    label: '.label-hint is lighter and muted',
    selector: '#lb-plain .label-hint',
    css: { 'font-weight': '400', 'font-size': '13px' },
  },
  {
    label: '[data-disabled] dims to 0.7 / not-allowed',
    selector: '#lb-disabled',
    css: { opacity: '0.7', cursor: 'not-allowed' },
  },
  {
    label: ':has(+ :disabled) dims the label of a disabled input (pure CSS)',
    run: async (page) => {
      const opacity = await page.$eval('#lb-sibling', (el) => getComputedStyle(el).opacity);
      assert.equal(opacity, '0.7');
    },
  },
]);
