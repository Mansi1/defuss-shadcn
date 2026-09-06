import assert from 'node:assert/strict';
import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: select is CSS-only — the appearance:none + inline-SVG chevron restyle
 * is the whole control. Verify the 40px box with chevron padding, the custom
 * chevron background, sm/lg sizes, disabled, and the invalid border.
 */
await cssSmoke('select', [
  {
    label: '.select is a 40px appearance-none control with chevron room',
    selector: '#se-default',
    css: { appearance: 'none', height: '40px', padding: '0px 32px 0px 12px', cursor: 'pointer' },
  },
  {
    label: 'custom chevron drawn via inline-SVG background (right-aligned, 1rem)',
    run: async (page) => {
      const bg = await page.$eval('#se-default', (el) => {
        const cs = getComputedStyle(el);
        return { image: cs.backgroundImage, repeat: cs.backgroundRepeat, size: cs.backgroundSize };
      });
      assert.match(bg.image, /url\("data:image\/svg\+xml/, 'SVG data-URI chevron');
      assert.equal(bg.repeat, 'no-repeat');
      // author set `background-size: 1rem` (single value → height auto)
      assert.match(bg.size, /^16px (auto|16px)$/);
    },
  },
  {
    label: 'data-size sm/lg heights 32 / 44',
    run: async (page) => {
      const [sm, lg] = await page.evaluate(() => [
        document.querySelector('#se-sm')!.getBoundingClientRect().height,
        document.querySelector('#se-lg')!.getBoundingClientRect().height,
      ]);
      assert.equal(sm, 32);
      assert.equal(lg, 44);
    },
  },
  {
    label: ':disabled dims to 0.5 / not-allowed',
    selector: '#se-disabled',
    css: { opacity: '0.5', cursor: 'not-allowed' },
  },
  {
    label: 'aria-invalid recolors the border',
    distinct: [
      { selector: '#se-default', prop: 'border-top-color' },
      { selector: '#se-invalid', prop: 'border-top-color' },
    ],
  },
]);
