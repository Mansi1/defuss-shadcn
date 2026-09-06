import assert from 'node:assert/strict';
import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: table is CSS-only — the container (overflow + inline-size container
 * for the @container query), collapsed borders, head/cell geometry, and the
 * documented <480px compact query.
 */
await cssSmoke('table', [
  {
    label: 'container clips horizontally + is an inline-size container',
    selector: '#tb-wide',
    css: { 'overflow-x': 'auto', 'container-type': 'inline-size', 'border-top-width': '1px' },
  },
  {
    label: 'table collapses borders, left-aligns, caption sits at the bottom',
    selector: '.table',
    css: { 'border-collapse': 'collapse', 'font-size': '14px', 'text-align': 'left', 'caption-side': 'bottom' },
  },
  {
    label: 'head + cells share the 12px/16px padding; head is muted/500',
    run: async (page) => {
      const geo = await page.evaluate(() => ({
        headPad: getComputedStyle(document.querySelector('.table-head')!).padding,
        cellPad: getComputedStyle(document.querySelector('.table-cell')!).padding,
        headWeight: getComputedStyle(document.querySelector('.table-head')!).fontWeight,
      }));
      assert.equal(geo.headPad, '12px 16px');
      assert.equal(geo.cellPad, '12px 16px');
      assert.equal(geo.headWeight, '500');
    },
  },
  {
    label: '@container <480px swaps to 8px/12px padding + 13px text',
    run: async (page) => {
      const [wide, narrow] = await page.evaluate(() => [
        getComputedStyle(document.querySelector('#tb-wide .table-head')!).padding,
        getComputedStyle(document.querySelector('#tb-narrow .table-cell')!).padding,
      ]);
      assert.equal(wide, '12px 16px', 'wide table keeps default padding');
      assert.equal(narrow, '8px 12px', 'narrow table gets compact padding');
    },
  },
]);
