import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { startServer } from './server.ts';

/**
 * Why: the documentation site IS the product's public face — if index.html
 * doesn't render, or the SPA router / sidebar filter break, every consumer
 * and agent reading the docs is misled. This exercises the real shipped
 * dist/documentation/ pages over HTTP: web-component shell, token +
 * component CSS chain, SPA navigation (title/main/active-link/history), and
 * the nav filter ("search"), including the jsDelivr dogfooding note that
 * pairs the site with README's CDN quick start (AGENTS.md "README ↔ index
 * parity").
 */

const PAGE = '/dist/documentation/index.html';
/** Third-party CDNs the doc pages load (shiki via esm.sh, icons via unpkg);
 *  a sandboxed CI without egress may fail those — only first-party errors count. */
const VENDOR = /esm\.sh|unpkg\.com|cdnjs|api\.github\.com/;

const server = startServer();
const browser = await chromium.launch();

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
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => { if (!VENDOR.test(e.message)) pageErrors.push(e.message); });
  await page.goto(`${server.url}${PAGE}`);

  await check('page renders: web-component shell mounted', async () => {
    await page.waitForSelector('site-header .header-brand, site-nav .nav-link', { timeout: 10_000 });
    const counts = await page.evaluate(() => ({
      header: !!document.querySelector('site-header .header-brand'),
      links: document.querySelectorAll('site-nav .nav-link').length,
      sections: document.querySelectorAll('site-nav .nav-section').length,
    }));
    assert.ok(counts.header, 'site-header did not render the brand');
    // brand must read "defuss-shadcn" — the pre-fork "shadcn-html" regressed once
    assert.equal(
      await page.evaluate(() => document.querySelector('.header-brand-name')?.textContent?.trim()),
      'defuss-shadcn',
      'site header brand has the wrong name',
    );
    assert.ok(counts.links > 50, `expected the full sidebar (>50 links), got ${counts.links}`);
    assert.ok(counts.sections >= 8, `expected >8 nav sections, got ${counts.sections}`);
  });

  await check('CSS chain applied: tokens + component CSS render the intro', async () => {
    const facts = await page.evaluate(() => {
      const btn = document.querySelector('main a.btn') as HTMLElement | null;
      const cs = btn ? getComputedStyle(btn) : null;
      return {
        token: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
        primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
        height: cs?.height ?? null,
        bg: cs?.backgroundColor ?? null,
        radius: cs?.borderRadius ?? null,
      };
    });
    assert.ok(facts.token.length > 0, '--background token not applied (theme CSS missing?)');
    // the CTA is a flex ITEM, so inline-flex is blockified to flex — assert
    // button.css side effects blockification cannot fake: its fixed height,
    // token-derived background, and non-zero radius (none apply to a bare <a>)
    assert.equal(facts.height, '36px', `button.css height not applied (${facts.height})`);
    assert.notEqual(facts.radius, '0px', 'radius token not resolving through component CSS');
    // bg must be the resolved --primary, proving the token chain end-to-end
    const probe = await page.evaluate(
      (p) => { const d = document.createElement('div'); d.style.color = p; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; },
      facts.primary,
    );
    assert.equal(facts.bg, probe, 'button background is not the resolved --primary token');
  });

  await check('CDN dogfooding note present (README ↔ index parity, runtime side)', async () => {
    const text = await page.evaluate(() => document.querySelector('main')?.textContent ?? '');
    assert.match(text, /jsDelivr CDN/, 'index.html lost the CDN dogfooding note');
  });

  await check('SPA navigation: nav click swaps title, main and active link', async () => {
    const titleBefore = await page.title();
    await page.click('site-nav a.nav-link[href="badge.html"]');
    await page.waitForFunction(
      (t: string) => document.title !== t, titleBefore, { timeout: 5_000 },
    );
    const state = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('main h1')?.textContent?.trim() ?? '',
      active: document.querySelector('.nav-link.active')?.getAttribute('href') ?? '',
      url: location.pathname,
    }));
    assert.match(state.title, /Badge/, 'title not updated by the SPA router');
    assert.match(state.h1, /Badge/, 'main content not swapped');
    assert.equal(state.active, 'badge.html', 'active class did not move');
    assert.ok(state.url.endsWith('/badge.html'), `URL not pushed: ${state.url}`);
  });

  await check('Back button restores the previous page', async () => {
    await page.goBack();
    // popstate fires before the router's fetch+swap finishes — wait on the
    // swapped TITLE, not the pathname (which pops instantly and would race)
    await page.waitForFunction(() => !/Badge/.test(document.title), undefined, { timeout: 5_000 });
    const title = await page.title();
    assert.doesNotMatch(title, /Badge/, 'history back did not restore the intro');
  });

  await check('nav filter (search) hides non-matching links, keeps Overview', async () => {
    // the input lives in the header (next to the version badge) and its logic
    // filters the sidebar — pin the placement so it can't silently migrate back
    assert.ok(
      await page.evaluate(
        () => !!document.querySelector('.site-header .header-search .nav-filter-input') &&
          !document.querySelector('site-nav .nav-filter-input'),
      ),
      'search box is not (only) in the header',
    );
    const input = page.locator('.nav-filter-input');
    await input.fill('badge');
    const vis = await page.evaluate(() => {
      const link = (href: string) =>
        getComputedStyle(document.querySelector(`site-nav a.nav-link[href="${href}"]`)!).display !== 'none';
      const sections = [...document.querySelectorAll('site-nav .nav-section')];
      return {
        badge: link('badge.html'),
        dialog: link('dialog.html'),
        overviewVisible: getComputedStyle(sections[0]).display !== 'none',
      };
    });
    assert.ok(vis.badge, 'matching link (Badge) was hidden by the filter');
    assert.ok(!vis.dialog, 'non-matching link (Dialog) stayed visible');
    assert.ok(vis.overviewVisible, 'Overview section must never be filtered away');

    // case-insensitivity + clear restores everything
    await input.fill('DIALOG');
    assert.equal(
      await page.evaluate(() =>
        getComputedStyle(document.querySelector('site-nav a.nav-link[href="dialog.html"]')!).display !== 'none'),
      true,
      'filter is not case-insensitive',
    );
    await input.fill('');
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll('site-nav .nav-link')].every((a) => getComputedStyle(a).display !== 'none')),
      true,
      'clearing the filter did not restore all links',
    );
  });

  await check('Ctrl/Cmd+K focuses the filter (search shortcut)', async () => {
    await page.keyboard.press('Control+k');
    const focused = await page.evaluate(() => document.activeElement?.classList.contains('nav-filter-input'));
    assert.ok(focused, 'Ctrl+K did not focus the nav filter');
  });

  await check('no first-party page errors during the whole run', async () => {
    assert.deepEqual(pageErrors, [], `uncaught page errors: ${pageErrors.join(' | ')}`);
  });
} finally {
  await browser.close();
  server.stop();
}

if (failures) {
  console.error(`documentation.e2e: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('documentation.e2e: all checks passed');
