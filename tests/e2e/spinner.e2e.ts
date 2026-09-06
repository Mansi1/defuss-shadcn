import assert from 'node:assert/strict';
import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: spinner is CSS-only — the rotate keyframes + the four documented
 * sizes are the contract. Verify each size maps to its literal box and that
 * the 1s linear rotation actually runs.
 */
await cssSmoke('spinner', [
  {
    label: 'spinner sizes: default 16 / sm 14 / md 20 / lg 24',
    run: async (page) => {
      const sizes = await page.evaluate(() =>
        ['#sp-default', '#sp-sm', '#sp-md', '#sp-lg'].map(
          (s) => document.querySelector(s)!.getBoundingClientRect().width,
        ),
      );
      assert.deepEqual(sizes, [16, 14, 20, 24]);
    },
  },
  {
    label: 'spinner runs the 1s linear infinite rotation',
    run: async (page) => {
      const anim = await page.evaluate(() => {
        const el = document.querySelector('#sp-default')!;
        const cs = getComputedStyle(el);
        return {
          name: cs.animationName,
          duration: cs.animationDuration,
          timing: cs.animationTimingFunction,
          running: el.getAnimations().some((a) => a.playState === 'running'),
        };
      });
      assert.equal(anim.name, 'spinner-rotate');
      assert.equal(anim.duration, '1s');
      assert.equal(anim.timing, 'linear');
      assert.equal(anim.running, true, 'rotation is actually playing');
    },
  },
]);
