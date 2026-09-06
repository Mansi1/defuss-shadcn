import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { startServer } from './server.ts';

/**
 * Why: E2E smoke test for the shipped sheet component. Loads the fixture
 * (one sheet per documented side, mirroring the doc page) over HTTP in a real
 * browser, then verifies the slide-out geometry per side, trigger/close
 * wiring, Escape-to-close, and the named State API — the same files consumers
 * copy from dist/, unmodified.
 */

const FIXTURE = '/tests/e2e/sheet.e2e-fixture.html';
const server = startServer();
const browser = await chromium.launch();

const isOpen = (page: Page, id: string) => page.$eval(`#${id}`, (el) => (el as HTMLDialogElement).open);
const setState = (page: Page, id: string, state: string) =>
  page.$eval(`#${id}`, (el, s) => (el as HTMLElement).api!.setState(s), state);

/** Open a sheet via setState and wait for the 300ms slide-in to settle. */
async function open(page: Page, id: string): Promise<void> {
  await setState(page, id, 'open');
  await page.$eval(
    `#${id}`,
    (el) =>
      new Promise<void>((resolve) => {
        // transitionend fires per property (opacity + transform) — wait for transform
        if (!el.classList.contains('sheet')) return resolve();
        const done = (ev: Event) => {
          if (!(ev instanceof TransitionEvent)) return;
          if (ev.propertyName === 'transform') {
            el.removeEventListener('transitionend', done);
            resolve();
          }
        };
        el.addEventListener('transitionend', done);
        setTimeout(resolve, 600); // safety net: transition may already be done
      }),
  );
}

let failures = 0;
async function check(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${label}\n    ${err instanceof Error ? err.message : err}`);
  }
}

try {
  const page = await browser.newPage();
  await page.goto(`${server.url}${FIXTURE}`);

  await check('sheet.js initialized triggers + sheets (data-init)', async () => {
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-sheet-trigger]:not([data-init])').length === 0 &&
        document.querySelectorAll('dialog.sheet:not([data-init])').length === 0,
    );
  });

  // rect() widths include the 1px dock border and innerWidth includes the
  // classic scrollbar — assert layout viewport (clientWidth/clientHeight) and
  // computed width instead of raw rects.
  await check('right sheet: docked right, 24rem wide, full height', async () => {
    await open(page, 'sheet-right');
    const geom = await page.evaluate(() => {
      const el = document.querySelector('#sheet-right')!;
      const r = el.getBoundingClientRect();
      return {
        right: r.right,
        cssWidth: getComputedStyle(el).width,
        height: r.height,
        viewportW: document.documentElement.clientWidth,
        viewportH: document.documentElement.clientHeight,
        opacity: getComputedStyle(el).opacity,
      };
    });
    assert.equal(geom.cssWidth, '384px', 'width: 24rem');
    assert.equal(Math.round(geom.right), geom.viewportW, 'docked to the right edge');
    assert.equal(Math.round(geom.height), geom.viewportH, 'full height');
    assert.equal(geom.opacity, '1', 'slid in (opacity 1)');
  });

  await check('left sheet: docked left edge', async () => {
    await setState(page, 'sheet-right', 'default');
    await open(page, 'sheet-left');
    const geom = await page.evaluate(() => {
      const r = document.querySelector('#sheet-left')!.getBoundingClientRect();
      return { x: r.x, cssWidth: getComputedStyle(document.querySelector('#sheet-left')!).width };
    });
    assert.equal(Math.round(geom.x), 0, 'flush with left edge');
    assert.equal(geom.cssWidth, '384px', 'width: 24rem');
  });

  await check('top sheet: docked top, full width', async () => {
    await setState(page, 'sheet-left', 'default');
    await open(page, 'sheet-top');
    const geom = await page.evaluate(() => {
      const r = document.querySelector('#sheet-top')!.getBoundingClientRect();
      return { y: r.y, width: r.width, viewport: document.documentElement.clientWidth };
    });
    assert.equal(Math.round(geom.y), 0, 'flush with top edge');
    assert.equal(Math.round(geom.width), geom.viewport, 'full width');
  });

  await check('bottom sheet: docked bottom, full width', async () => {
    await setState(page, 'sheet-top', 'default');
    await open(page, 'sheet-bottom');
    const geom = await page.evaluate(() => {
      const r = document.querySelector('#sheet-bottom')!.getBoundingClientRect();
      return {
        bottom: r.bottom,
        width: r.width,
        viewport: document.documentElement.clientWidth,
        vh: document.documentElement.clientHeight,
      };
    });
    assert.equal(Math.round(geom.bottom), geom.vh, 'flush with bottom edge');
    assert.equal(Math.round(geom.width), geom.viewport, 'full width');
    await setState(page, 'sheet-bottom', 'default');
  });

  await check('trigger button opens; data-sheet-close closes', async () => {
    await page.click('[data-sheet-trigger="sheet-right"]');
    assert.equal(await isOpen(page, 'sheet-right'), true);
    await page.click('#sheet-right [data-sheet-close]');
    assert.equal(await isOpen(page, 'sheet-right'), false);
  });

  await check('Escape closes (native dialog behavior preserved)', async () => {
    await setState(page, 'sheet-right', 'open');
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page, 'sheet-right'), false, 'native Escape-to-close must still work');
  });

  await check('focus returns to trigger on close', async () => {
    await page.click('[data-sheet-trigger="sheet-left"]');
    await page.waitForFunction(() => document.querySelector('#sheet-left')!.matches(':open'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute('data-sheet-trigger'),
    );
    assert.equal(focused, 'sheet-left', 'trigger must be refocused after close');
  });

  // -- State API (AGENTS.md "State API") -------------------------------------
  await check('state API: default state reported, setState(open)/getState work', async () => {
    const before = await page.$eval('#sheet-right', (el) => (el as HTMLElement).api!.getState());
    assert.equal(before.name, 'default');
    await setState(page, 'sheet-right', 'open');
    assert.equal(await isOpen(page, 'sheet-right'), true);
    const state = await page.$eval('#sheet-right', (el) => (el as HTMLElement).api!.getState());
    assert.equal(state.name, 'open');
    await setState(page, 'sheet-right', 'default');
    assert.equal(await isOpen(page, 'sheet-right'), false);
  });

  await check('state API: unknown state names throw', async () => {
    const err = await page.evaluate(() => {
      try {
        (document.querySelector('#sheet-right') as HTMLElement).api!.setState('nope');
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    assert.ok(err && err.includes('unknown state'), `expected throw, got ${err}`);
  });

  await check('state API: registry globals expose api + declared states', async () => {
    const reg = await page.evaluate(() => ({
      hasApi: typeof globalThis._defussShadcn?.sheetApi?.setState === 'function',
      states: globalThis._defussShadcn?.sheetStates,
      dollarWorks: typeof globalThis.$ === 'function' && !!globalThis.$('#sheet-right'),
    }));
    assert.ok(reg.hasApi, '_defussShadcn.sheetApi.setState missing');
    assert.deepEqual(reg.states, ['default', 'open']);
    assert.ok(reg.dollarWorks, 'globalThis.$ query alias missing');
  });
} finally {
  await browser.close();
  server.stop();
}

if (failures) {
  console.error(`\nsheet.e2e: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('sheet.e2e: all checks passed');
