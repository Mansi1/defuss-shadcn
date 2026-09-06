import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { startServer } from './server.ts';

/**
 * Why: E2E smoke test for the shipped toast component. Loads the fixture
 * (existing #toast-container + variant buttons, mirroring the doc page) over
 * HTTP in a real browser, then verifies the programmatic window.toast API
 * (show/variants/roles), the delegated close button, the MAX_VISIBLE trim,
 * and the region's named State API (setState('default') clears; getState()
 * reports the live count) — the same files consumers copy from dist/,
 * unmodified.
 */

const FIXTURE = '/tests/e2e/toast.e2e-fixture.html';
const server = startServer();
const browser = await chromium.launch();

const toastCount = (page: Page) => page.$$eval('#toast-container .toast', (els) => els.length);
const MAX_VISIBLE = 3; // component contract

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

  await check('toast.js reused the existing container + delegated wiring (data-init)', async () => {
    // the init marker is the empty-string convention, so test the ATTRIBUTE
    await page.waitForFunction(() => {
      const c = document.getElementById('toast-container');
      return !!c?.hasAttribute('data-init') && !!(c as HTMLElement).api;
    });
  });

  await check('toast.css applied (fixed region positioned)', async () => {
    const style = await page.$eval('#toast-container', (el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, z: cs.zIndex };
    });
    assert.equal(style.position, 'fixed', 'overlay region');
    assert.ok(Number(style.z) >= 50, 'above page content');
  });

  await check('toast.show() renders a toast with title + description (role=status)', async () => {
    await page.click('#t-show');
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 1);
    const info = await page.$eval('#toast-container .toast', (el) => ({
      title: el.querySelector('.toast-title')?.textContent,
      desc: el.querySelector('.toast-description')?.textContent,
      role: el.getAttribute('role'),
      open: el.matches(':popover-open'),
    }));
    assert.equal(info.title, 'Event created');
    assert.equal(info.desc, 'Monday, January 3rd at 6:00pm');
    assert.equal(info.role, 'status', 'non-destructive toasts are polite');
    assert.equal(info.open, true, 'shown via the Popover API');
  });

  await check('every CSS variant renders with icon + correct role', async () => {
    // one variant at a time (the region is cleared between them) so the
    // MAX_VISIBLE trim can't dismiss what we're about to assert
    const expectations: Record<string, string> = {
      success: 'status',
      warning: 'status',
      info: 'status',
      destructive: 'alert',
    };
    for (const [variant, role] of Object.entries(expectations)) {
      await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.setState('default'));
      await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
      await page.click(`#t-${variant}`);
      await page.waitForFunction(() => !!document.querySelector('#toast-container .toast'));
      const info = await page.$eval('#toast-container .toast', (el) => ({
        v: el.getAttribute('data-variant'),
        r: el.getAttribute('role'),
        icon: !!el.querySelector('.toast-icon'),
      }));
      assert.equal(info.v, variant);
      assert.equal(info.r, role, `${variant} role`);
      assert.ok(info.icon, `${variant} renders its icon`);
    }
    await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.setState('default'));
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
  });

  await check(`more than ${MAX_VISIBLE} toasts trims the oldest`, async () => {
    await page.evaluate(() => (window as any).toast.show('fourth'));
    await page.waitForFunction(
      (max) => document.querySelectorAll('#toast-container .toast').length <= max,
      MAX_VISIBLE,
    );
    assert.ok((await toastCount(page)) <= MAX_VISIBLE);
  });

  await check('close button dismisses a toast (delegated listener)', async () => {
    // deterministic stage: clear the region, then one non-expiring toast
    await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.setState('default'));
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
    await page.evaluate(() => (window as any).toast.show({ title: 'closeme', duration: Infinity }));
    await page.waitForFunction(() => !!document.querySelector('#toast-container .toast .toast-close'));
    await page.click('#toast-container .toast .toast-close');
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
  });

  await check('action button runs onClick and dismisses', async () => {
    await page.evaluate(() => {
      (window as any).__clicked = false;
      (window as any).toast.show({
        title: 'Archive',
        action: { label: 'Undo', onClick: () => ((window as any).__clicked = true) },
        duration: Infinity, // keep it until we act
      });
    });
    await page.waitForFunction(() => !!document.querySelector('[data-toast-action]'));
    await page.click('[data-toast-action]');
    assert.equal(await page.evaluate(() => (window as any).__clicked), true);
    await page.waitForFunction(() => !document.querySelector('#toast-container .toast'));
  });

  // -- State API (AGENTS.md "State API") --------------------------------------
  await check("state API: setState('default') dismisses every visible toast", async () => {
    await page.evaluate(() => {
      (window as any).toast.show({ title: 'a', duration: Infinity });
      (window as any).toast.show({ title: 'b', duration: Infinity });
    });
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 2);
    const mid = await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.getState());
    assert.equal(mid.config.count, 2, 'live count while visible');
    await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.setState('default'));
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
  });

  await check('state API: getState name stays default and count is live', async () => {
    await page.evaluate(() => (window as any).toast.show({ title: 'counted', duration: Infinity }));
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 1);
    const state = await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.getState());
    assert.equal(state.name, 'default');
    assert.equal(state.config.count, 1);
    await page.$eval('#toast-container', (el) => (el as HTMLElement).api!.setState('default'));
    await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
  });

  await check('state API: unknown state names throw', async () => {
    const err = await page.evaluate(() => {
      try {
        (document.getElementById('toast-container') as HTMLElement).api!.setState('nope');
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    assert.ok(err && err.includes('unknown state'), `expected throw, got ${err}`);
  });

  await check('state API: registry globals expose api + declared states', async () => {
    const reg = await page.evaluate(() => ({
      hasApi: typeof globalThis._defussShadcn?.toastApi?.setState === 'function',
      states: globalThis._defussShadcn?.toastStates,
      dollarWorks: typeof globalThis.$ === 'function' && !!globalThis.$('#toast-container'),
    }));
    assert.ok(reg.hasApi, '_defussShadcn.toastApi.setState missing');
    assert.deepEqual(reg.states, ['default']);
    assert.ok(reg.dollarWorks, 'globalThis.$ query alias missing');
  });
} finally {
  await browser.close();
  server.stop();
}

if (failures) {
  console.error(`\ntoast.e2e: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('toast.e2e: all checks passed');
