import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

/**
 * Why: E2E smoke test for the shipped accordion component. Loads the fixture
 * (every accordion configuration at once) over HTTP in a real browser, then
 * verifies component CSS was applied and accordion.js wiring works — the same
 * files consumers copy from dist/, unmodified.
 */

const FIXTURE = '/tests/e2e/accordion.e2e-fixture.html';
const server = startServer();
const browser = await chromium.launch();

/** Polls the open[] flags of an accordion's items until they match `expected`. */
async function expectOpen(page, id, expected, label) {
  let actual;
  for (let i = 0; i < 100; i++) {
    actual = await page.$$eval(`#${id} .accordion-item`, (els) => els.map((el) => el.open));
    if (actual.join(',') === expected.join(',')) return;
    await page.waitForTimeout(20);
  }
  assert.fail(`${label}: #${id} expected [${expected}] but got [${actual}]`);
}

const clickItem = (page, id, n) =>
  page.click(`#${id} .accordion-item[data-item="${n}"] > summary`);

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${label}\n    ${err.message}`);
  }
}

try {
  const page = await browser.newPage();
  await page.goto(`${server.url}${FIXTURE}`);

  await check('accordion.js initialized every single-open accordion (data-init)', async () => {
    // multi-open accordions need no JS, so only data-type="single" wrappers get tagged
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.accordion[data-type="single"]:not([data-init])').length === 0,
    );
  });

  await check('initial open state matches each configuration', async () => {
    await expectOpen(page, 'multi', [true, false, false], 'initial');
    await expectOpen(page, 'single', [true, false, false], 'initial');
    await expectOpen(page, 'collapsible', [true, false, false], 'initial');
    await expectOpen(page, 'bordered', [false, false], 'initial');
    await expectOpen(page, 'card', [true, false], 'initial');
  });

  await check('accordion.css applied (wrapper flex, open chevron rotated)', async () => {
    const styles = await page.$eval('#multi', (el) => getComputedStyle(el).display);
    assert.equal(styles, 'flex', 'accordion wrapper should be display:flex');
    const chevron = await page.$eval(
      '#multi .accordion-item[data-item="1"] .accordion-chevron',
      (el) => getComputedStyle(el).transform,
    );
    assert.match(chevron, /matrix\(\s*-1/, 'open item chevron should be rotated 180deg');
  });

  await check('multi-open: several items can stay open', async () => {
    await clickItem(page, 'multi', 2);
    await clickItem(page, 'multi', 3);
    await expectOpen(page, 'multi', [true, true, true], 'multi-open');
  });

  await check('single-open: opening an item closes its siblings', async () => {
    await clickItem(page, 'single', 2);
    await expectOpen(page, 'single', [false, true, false], 'after opening 2');
    await clickItem(page, 'single', 3);
    await expectOpen(page, 'single', [false, false, true], 'after opening 3');
  });

  await check('single-open (not collapsible): cannot close the last open item', async () => {
    await clickItem(page, 'single', 3); // natively closes, JS immediately re-opens it
    await expectOpen(page, 'single', [false, false, true], 're-opens itself');
  });

  await check('collapsible single: allows all items closed', async () => {
    await clickItem(page, 'collapsible', 1);
    await expectOpen(page, 'collapsible', [false, false, false], 'all closed');
    await clickItem(page, 'collapsible', 2);
    await expectOpen(page, 'collapsible', [false, true, false], 're-opened one');
  });

  await check('bordered variant toggles independently (multi-open)', async () => {
    await clickItem(page, 'bordered', 1);
    await clickItem(page, 'bordered', 2);
    await expectOpen(page, 'bordered', [true, true], 'both open');
  });

  await check('card-wrapped single-open works inside a card', async () => {
    await clickItem(page, 'card', 2);
    await expectOpen(page, 'card', [false, true], 'card 2 open');
  });

  await check('keyboard: Enter toggles the focused summary (native)', async () => {
    await page.focus('#multi .accordion-item[data-item="1"] > summary');
    await page.keyboard.press('Enter');
    await expectOpen(page, 'multi', [false, true, true], 'after Enter');
    await page.keyboard.press('Enter');
    await expectOpen(page, 'multi', [true, true, true], 'after second Enter');
  });
} finally {
  await browser.close();
  server.stop();
}

if (failures) {
  console.error(`\naccordion.e2e: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('accordion.e2e: all checks passed');
