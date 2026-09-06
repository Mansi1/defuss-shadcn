import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { startServer } from './server.ts';

/**
 * Why: E2E smoke test for the shipped combobox component. Loads the fixture
 * (flat list + grouped list with a disabled option and separator, mirroring
 * the doc page) over HTTP in a real browser, then verifies trigger toggling,
 * search filtering with empty state, keyboard navigation and selection,
 * group/separator/option hiding, and the per-popover named State API — the
 * same files consumers copy from dist/, unmodified.
 */

const FIXTURE = '/tests/e2e/combobox.e2e-fixture.html';
const server = startServer();
const browser = await chromium.launch();

const isOpen = (page: Page, id: string) => page.$eval(`#${id}`, (el) => el.matches(':popover-open'));
const expanded = (page: Page) =>
  page.$eval('#cb-demo .combobox-trigger', (el) => el.getAttribute('aria-expanded'));
const visibleOptions = (page: Page, popoverId: string) =>
  page.$$eval(`#${popoverId} [role="option"]:not([hidden])`, (els) =>
    els.map((el) => el.textContent!.trim()),
  );
const triggerText = (page: Page, id = 'cb-demo') =>
  page.$eval(`#${id} .combobox-value`, (el) => el.textContent!.trim());

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

  await check('combobox.js initialized + anchor wiring (data-init, position-anchor)', async () => {
    await page.waitForFunction(() => document.querySelectorAll('.combobox:not([data-init])').length === 0);
    const pair = await page.evaluate(() => {
      const trigger = document.querySelector('#cb-demo .combobox-trigger') as HTMLElement;
      const popover = document.querySelector('#cb-framework-popover') as HTMLElement;
      return { anchor: trigger.style.anchorName, uses: popover.style.positionAnchor };
    });
    assert.ok(pair.anchor.startsWith('--combobox-'), 'trigger needs an anchor name');
    assert.equal(pair.uses, pair.anchor, 'popover must use its trigger anchor');
  });

  await check('combobox.css applied (listbox surface)', async () => {
    const style = await page.$eval('#cb-framework-popover', (el) => {
      const cs = getComputedStyle(el);
      return { radius: cs.borderTopLeftRadius, bg: cs.backgroundColor };
    });
    assert.notEqual(style.radius, '0px', 'rounded popover');
    assert.notEqual(style.bg, 'rgba(0, 0, 0, 0)', 'opaque popover surface');
  });

  await check('trigger click opens the listbox and focuses search', async () => {
    await page.click('#cb-demo .combobox-trigger');
    assert.equal(await isOpen(page, 'cb-framework-popover'), true);
    assert.equal(await expanded(page), 'true', 'aria-expanded synced');
    const focused = await page.evaluate(() => document.activeElement?.className);
    assert.match(focused ?? '', /combobox-search-input/, 'search input receives focus');
  });

  await check('typing filters options and hides non-matching groups', async () => {
    await page.keyboard.type('nu');
    assert.deepEqual(await visibleOptions(page, 'cb-framework-popover'), ['Nuxt']);
    const emptyHidden = await page.$eval('#cb-framework-popover .combobox-empty', (el) => (el as HTMLElement).hidden);
    assert.equal(emptyHidden, true, 'no-results hidden while something matches');
    await page.keyboard.type('xyz');
    assert.deepEqual(await visibleOptions(page, 'cb-framework-popover'), []);
    const emptyShown = await page.$eval('#cb-framework-popover .combobox-empty', (el) => (el as HTMLElement).hidden);
    assert.equal(emptyShown, false, '.combobox-empty shows when nothing matches');
  });

  await check('clearing filters and ArrowDown/ArrowUp move the highlight + activedescendant', async () => {
    // clearing re-filters and auto-highlights the first match (component's input handler)
    await page.fill('#cb-demo .combobox-search-input', '');
    assert.equal(
      await page.$eval('#cb-demo .combobox-search-input', (el) => el.getAttribute('aria-activedescendant')),
      'cb-opt-next',
      'first option auto-highlighted',
    );
    await page.keyboard.press('ArrowDown');
    assert.equal(
      await page.$eval('#cb-demo .combobox-search-input', (el) => el.getAttribute('aria-activedescendant')),
      'cb-opt-svelte',
    );
    await page.keyboard.press('ArrowUp');
    assert.equal(
      await page.$eval('#cb-demo .combobox-search-input', (el) => el.getAttribute('aria-activedescendant')),
      'cb-opt-next',
    );
  });

  await check('Enter selects the highlighted option and closes', async () => {
    await page.keyboard.press('Enter');
    assert.equal(await isOpen(page, 'cb-framework-popover'), false, 'selection closes the listbox');
    assert.equal(await triggerText(page), 'Next.js', 'trigger shows the selection');
    assert.equal(await expanded(page), 'false', 'aria-expanded reset');
    const selected = await page.$eval('#cb-opt-next', (el) => el.getAttribute('aria-selected'));
    assert.equal(selected, 'true');
  });

  await check('Escape closes and restores focus to the trigger', async () => {
    await page.click('#cb-demo .combobox-trigger');
    await page.waitForFunction(() => document.querySelector('#cb-framework-popover')!.matches(':popover-open'));
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page, 'cb-framework-popover'), false);
    const focused = await page.evaluate(() => document.activeElement?.className);
    assert.match(focused ?? '', /combobox-trigger/, 'trigger refocused');
  });

  await check('click selects an option directly', async () => {
    await page.click('#cb-demo .combobox-trigger');
    await page.click('#cb-opt-astro');
    assert.equal(await triggerText(page), 'Astro');
  });

  await check('selection check: mask (not black data-URI image) + aligned rows', async () => {
    // regression: a data: URI SVG resolves currentColor to BLACK as an image —
    // the check was invisible in dark mode; and an in-flow ::before shifted the
    // selected row's text out of alignment with the other rows
    await page.click('#cb-demo .combobox-trigger');
    await page.waitForFunction(() => document.querySelector('#cb-framework-popover')!.matches(':popover-open'));
    const geom = await page.evaluate(() => {
      const sel = document.querySelector('#cb-opt-astro')!;
      const unsel = document.querySelector('#cb-opt-next')!;
      const b = getComputedStyle(sel, '::before');
      return {
        mask: b.maskImage || b.webkitMaskImage || 'none',
        bgImg: b.backgroundImage,
        bgColor: b.backgroundColor,
        selPad: getComputedStyle(sel).paddingInlineStart,
        unselPad: getComputedStyle(unsel).paddingInlineStart,
        pos: b.position,
      };
    });
    assert.notEqual(geom.mask, 'none', 'check uses a mask so currentColor applies');
    assert.match(geom.mask, /url\(/, 'mask-image is the check glyph');
    assert.ok(!/svg/.test(geom.bgImg), 'no data-URI SVG background (renders black)');
    assert.notEqual(geom.bgColor, 'rgba(0, 0, 0, 0)', 'background-color paints the mask');
    assert.equal(geom.pos, 'absolute', 'check is absolutely positioned');
    assert.equal(geom.selPad, geom.unselPad, 'selected row keeps the same indent');
    await page.keyboard.press('Escape');
  });

  await check('grouped listbox: labels, separators, disabled options', async () => {
    await page.click('#cb-grouped .combobox-trigger');
    await page.waitForFunction(() => document.querySelector('#cb-tz-popover')!.matches(':popover-open'));
    assert.deepEqual(await visibleOptions(page, 'cb-tz-popover'), [
      'PT (Los Angeles)',
      'ET (New York)',
      'EET (Bucharest)',
    ]);
    // clicking the disabled option must not select or close (pointer-events:
    // none in CSS + JS aria-disabled guard — force to bypass actionability)
    await page.click('#cb-tz-eet', { force: true });
    assert.equal(await isOpen(page, 'cb-tz-popover'), true, 'disabled click keeps it open');
    assert.equal(await triggerText(page, 'cb-grouped'), 'Select timezone...', 'disabled option not selected');
    // arrow navigation skips the disabled option
    await page.fill('#cb-grouped .combobox-search-input', '');
    await page.keyboard.press('End');
    assert.equal(
      await page.$eval('#cb-grouped .combobox-search-input', (el) => el.getAttribute('aria-activedescendant')),
      'cb-tz-et',
      'End lands on the last *enabled* option',
    );
    // filtering hides a group label whose options all vanish, plus separators
    await page.fill('#cb-grouped .combobox-search-input', 'los angeles');
    const states = await page.evaluate(() => ({
      naLabel: !(document.querySelector('#cb-tz-popover .combobox-group-label') as HTMLElement).hidden,
      euLabel: (document.querySelectorAll('#cb-tz-popover .combobox-group-label')[1] as HTMLElement).hidden,
      sep: (document.querySelector('#cb-tz-popover .combobox-separator') as HTMLElement).hidden,
    }));
    assert.equal(states.naLabel, true, 'North America label stays (has a match)');
    assert.equal(states.euLabel, true, 'Europe label hides (no match)');
    assert.equal(states.sep, true, 'separator adjacent to hidden items hides');
  });

  // -- State API (AGENTS.md "State API"), bound per popover ------------------
  const setState = (page: Page, id: string, state: string) =>
    page.$eval(`#${id}`, (el, s) => (el as HTMLElement).api!.setState(s), state);

  await check("state API: setState('open') shows the listbox; getState reports", async () => {
    await setState(page, 'cb-framework-popover', 'default'); // ensure closed first
    await setState(page, 'cb-framework-popover', 'open');
    // the deferred show waits out any running exit transition (≤500ms cap)
    await page.waitForFunction(() => document.querySelector('#cb-framework-popover')!.matches(':popover-open'));
    const state = await page.$eval('#cb-framework-popover', (el) => (el as HTMLElement).api!.getState());
    assert.equal(state.name, 'open');
    assert.equal(state.config.value, 'Astro', 'live selection mirrored into config');
  });

  await check("state API: setState('default') closes the listbox", async () => {
    await setState(page, 'cb-framework-popover', 'default');
    assert.equal(await isOpen(page, 'cb-framework-popover'), false);
    assert.equal(await expanded(page), 'false', 'aria-expanded still managed by close()');
  });

  await check('state API: getState reflects trigger clicks (no setState involved)', async () => {
    await page.click('#cb-demo .combobox-trigger');
    await page.waitForFunction(() => document.querySelector('#cb-framework-popover')!.matches(':popover-open'));
    const state = await page.$eval('#cb-framework-popover', (el) => (el as HTMLElement).api!.getState());
    assert.equal(state.name, 'open');
  });

  await check('state API: unknown state names throw', async () => {
    const err = await page.evaluate(() => {
      try {
        (document.querySelector('#cb-framework-popover') as HTMLElement).api!.setState('nope');
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    assert.ok(err && err.includes('unknown state'), `expected throw, got ${err}`);
  });

  await check('state API: registry globals expose api + declared states', async () => {
    const reg = await page.evaluate(() => ({
      hasApi: typeof globalThis._defussShadcn?.comboboxApi?.setState === 'function',
      states: globalThis._defussShadcn?.comboboxStates,
      dollarWorks: typeof globalThis.$ === 'function' && !!globalThis.$('#cb-framework-popover'),
    }));
    assert.ok(reg.hasApi, '_defussShadcn.comboboxApi.setState missing');
    assert.deepEqual(reg.states, ['default', 'open']);
    assert.ok(reg.dollarWorks, 'globalThis.$ query alias missing');
  });
} finally {
  await browser.close();
  server.stop();
}

if (failures) {
  console.error(`\ncombobox.e2e: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('combobox.e2e: all checks passed');
