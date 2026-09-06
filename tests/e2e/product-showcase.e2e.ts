import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: product-showcase is a standalone 5:3 frame + play button — verify the
 * same geometry contract as the Hero's media block, applied from its own CSS.
 */
await cssSmoke('product-showcase', [
  {
    label: 'frame is a 5:3 overflow-hidden rounded box',
    selector: '.mk-showcase',
    css: { 'aspect-ratio': '5 / 3', overflow: 'hidden' },
  },
  {
    label: 'image cover-fills the frame',
    selector: '.mk-showcase img',
    css: { 'object-fit': 'cover' },
  },
  {
    label: 'play button is a 64px circle above the image',
    selector: '.mk-showcase-play',
    css: { width: '64px', height: '64px', 'border-radius': '9999px', position: 'absolute', 'z-index': '10' },
  },
  {
    label: 'play button is centered in the frame',
    run: async (page) => {
      const off = await page.evaluate(() => {
        const f = document.querySelector('.mk-showcase')!.getBoundingClientRect();
        const p = document.querySelector('.mk-showcase-play')!.getBoundingClientRect();
        return Math.max(
          Math.abs(f.left + f.width / 2 - (p.left + p.width / 2)),
          Math.abs(f.top + f.height / 2 - (p.top + p.height / 2)),
        );
      });
      if (off > 1) throw new Error(`play off-center by ${off}px`);
    },
  },
]);
