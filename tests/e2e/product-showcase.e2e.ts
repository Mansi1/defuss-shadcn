import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: product-showcase is a native <video controls> frame — verify the
 * 5:3 box, the cover-fill on the video, and that the browser's own
 * controls are on (no custom play button shipped).
 */
await cssSmoke('product-showcase', [
  {
    label: 'frame is a 5:3 overflow-hidden rounded box',
    selector: '.mk-showcase',
    css: { 'aspect-ratio': '5 / 3', overflow: 'hidden' },
  },
  {
    label: 'video cover-fills the frame',
    selector: '.mk-showcase video',
    css: { 'object-fit': 'cover', display: 'block' },
  },
  {
    label: 'video carries native controls + webm/mp4 fallbacks (no custom overlay)',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const v = document.querySelector('.mk-showcase video') as HTMLVideoElement;
        return {
          controls: v.controls,
          poster: v.getAttribute('poster') ?? '',
          types: [...v.querySelectorAll('source')].map((s) => s.getAttribute('type')),
          overlay: !!document.querySelector('.mk-showcase-play'),
        };
      });
      if (!r.controls) throw new Error('video lacks controls');
      if (!r.poster) throw new Error('video lacks poster');
      if (!r.types.includes('video/webm') || !r.types.includes('video/mp4'))
        throw new Error(`codecs: ${r.types.join(',')}`);
      if (r.overlay) throw new Error('custom play overlay must not exist — controls are native');
    },
  },
]);
