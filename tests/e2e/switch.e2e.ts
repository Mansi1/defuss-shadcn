import assert from 'node:assert/strict';
import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: switch is CSS-only — appearance:none track + a translated ::after
 * thumb is the entire control. Verify the 36x20 pill, the thumb geometry,
 * the checked fill/translate, sm sizing, disabled, and invalid colors.
 */
await cssSmoke('switch', [
  {
    label: '.switch is a 36x20 appearance-none pill',
    selector: '#sw-off',
    css: { appearance: 'none', width: '36px', height: '20px', 'border-radius': '9999px', 'border-top-width': '0px' },
  },
  {
    label: '::after thumb is a 16px circle inset 2px',
    run: async (page) => {
      const t = await page.evaluate(() => {
        const s = getComputedStyle(document.querySelector('#sw-off')!, '::after');
        return { w: s.width, h: s.height, left: s.left, top: s.top };
      });
      assert.equal(t.w, '16px');
      assert.equal(t.h, '16px');
      assert.equal(t.left, '2px');
      assert.equal(t.top, '2px');
    },
  },
  {
    label: 'checked fills primary and slides the thumb 16px right',
    run: async (page) => {
      const [off, on] = await page.evaluate(() => [
        { bg: getComputedStyle(document.querySelector('#sw-off')!).backgroundColor, tx: getComputedStyle(document.querySelector('#sw-off')!, '::after').transform },
        { bg: getComputedStyle(document.querySelector('#sw-on')!).backgroundColor, tx: getComputedStyle(document.querySelector('#sw-on')!, '::after').transform },
      ]);
      assert.notEqual(off.bg, on.bg, 'checked uses --primary');
      assert.ok(off.tx === 'none' || off.tx === 'matrix(1, 0, 0, 1, 0, 0)', `unchecked thumb untransformed, got ${off.tx}`);
      assert.equal(on.tx, 'matrix(1, 0, 0, 1, 16, 0)', 'checked thumb translateX(1rem)');
    },
  },
  {
    label: 'sm size is a 28x16 track with a 12px thumb',
    run: async (page) => {
      const box = await page.evaluate(() => {
        const el = document.querySelector('#sw-sm')!;
        return {
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
          thumb: getComputedStyle(el, '::after').width,
        };
      });
      assert.equal(box.w, 28);
      assert.equal(box.h, 16);
      assert.equal(box.thumb, '12px');
    },
  },
  {
    label: 'disabled dims to 0.5 / not-allowed',
    selector: '#sw-disabled',
    css: { opacity: '0.5', cursor: 'not-allowed' },
  },
  {
    label: 'aria-invalid track uses destructive (distinct from off)',
    distinct: [
      { selector: '#sw-off', prop: 'background-color' },
      { selector: '#sw-invalid', prop: 'background-color' },
    ],
  },
]);
