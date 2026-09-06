import assert from 'node:assert/strict';
import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: progress is CSS-only — the native <progress> restyle is the whole
 * contract. Verify the pill geometry (appearance:none, 8px, full-width) and
 * that the webkit value/bar pseudo-elements carry the primary/secondary pair.
 */
await cssSmoke('progress', [
  {
    label: '.progress is an 8px pill with appearance reset',
    selector: '#pg-half',
    css: { appearance: 'none', height: '8px', 'border-radius': '9999px', 'border-top-width': '0px' },
  },
  {
    label: 'bar/value pseudo rules ship in the stylesheet (computed-style of ::-webkit-progress-* is unreliable)',
    run: async (page) => {
      const rules = await page.evaluate(async () => {
        const css = await (await fetch('/dist/components/progress/progress.css')).text();
        return {
          bar: /::-webkit-progress-bar\s*{[^}]*var\(--secondary\)/.test(css),
          value: /::-webkit-progress-value\s*{[^}]*var\(--primary\)/.test(css),
        };
      });
      assert.ok(rules.bar, 'bar uses --secondary');
      assert.ok(rules.value, 'value uses --primary');
    },
  },
  {
    label: 'a zero-width and a half-width bar share the same box height',
    run: async (page) => {
      const [half, empty] = await page.evaluate(() => [
        document.querySelector('#pg-half')!.getBoundingClientRect().height,
        document.querySelector('#pg-empty')!.getBoundingClientRect().height,
      ]);
      assert.equal(half, empty);
    },
  },
]);
