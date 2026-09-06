import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: hero is CSS-only — verify the copy/CTA column, the 5:3 showcase, and
 * the centered 64px play button all apply from hero.css (values at the
 * fixture's wide container: 30rem+ size steps).
 */
await cssSmoke('hero', [
  {
    label: 'hero stacks copy over media (48px base gap)',
    selector: '.mk-hero',
    css: { display: 'flex', 'flex-direction': 'column', gap: '48px' },
  },
  {
    label: 'badge is a pill (border-radius 9999px), 12px text',
    selector: '.mk-hero-badge',
    css: { 'border-radius': '9999px', 'font-size': '12px' },
  },
  {
    label: 'title renders at the wide size step (60px, weight 500)',
    selector: '.mk-hero-title',
    css: { 'font-size': '60px', 'font-weight': '500' },
  },
  {
    label: 'showcase image cover-crops inside the rounded 5:3 figure',
    selector: '.mk-hero-media img',
    css: { 'object-fit': 'cover' },
  },
  {
    label: 'media figure keeps the 5:3 ratio and rounds its corners',
    selector: '.mk-hero-media',
    css: { 'aspect-ratio': '5 / 3', overflow: 'hidden' },
  },
  {
    label: 'play button is a 64px circle, absolutely centered',
    selector: '.mk-hero-play',
    css: { width: '64px', height: '64px', 'border-radius': '9999px', position: 'absolute' },
  },
  {
    label: 'play button centers within the media (inset 0 + margin auto)',
    run: async (page) => {
      const off = await page.evaluate(() => {
        const media = document.querySelector('.mk-hero-media')!.getBoundingClientRect();
        const play = document.querySelector('.mk-hero-play')!.getBoundingClientRect();
        return {
          x: Math.abs(media.left + media.width / 2 - (play.left + play.width / 2)),
          y: Math.abs(media.top + media.height / 2 - (play.top + play.height / 2)),
        };
      });
      if (off.x > 1 || off.y > 1) throw new Error(`play off-center by ${off.x},${off.y}px`);
    },
  },
]);
