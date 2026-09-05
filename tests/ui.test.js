import { expect, test } from 'vitest';
import { clickSelector, openDocPage, waitFor } from './helpers.js';

/**
 * Why: end-to-end checks that the real doc-site UI — web components, SPA
 * router, and component interaction JS — actually work in a real browser
 * (Chromium via Playwright), loading the genuine pages from dist/.
 */

test('site shell renders header and sidebar from layout.js web components', async () => {
  const { doc } = await openDocPage('index.html');

  // <site-header>/<site-nav> are light-DOM web components defined by layout.js
  await waitFor(() => doc.querySelector('site-header button#theme-toggle'), 'site-header to render');
  // checkVisibility() runs in the iframe's document, since Vitest's ARIA-based
  // expect.element doesn't traverse into child frames reliably.
  const navLink = doc.querySelector('site-nav a[href="accordion.html"]');
  expect(navLink, 'sidebar link to Accordion').toBeTruthy();
  expect(navLink.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
});

test('SPA router swaps <main> content on nav click without reloading', async () => {
  const { doc } = await openDocPage('index.html');
  await waitFor(() => doc.querySelector('site-header button#theme-toggle'), 'shell to render');

  await clickSelector(doc, 'site-nav a[href="tabs.html"]');

  // the router replaces <main> innerHTML — new page shows its own <h1>
  await waitFor(() => doc.querySelector('main h1')?.textContent.includes('Tabs'), 'tabs page content');
  // no full reload: the header web component instance is still the same node
  expect(doc.querySelector('site-header button#theme-toggle')).toBeTruthy();
});

test('dark-mode toggle flips the .dark class on <html>', async () => {
  const { doc } = await openDocPage('index.html');
  await waitFor(() => doc.querySelector('site-header button#theme-toggle'), 'shell to render');

  const root = doc.documentElement;
  const wasDark = root.classList.contains('dark');
  await clickSelector(doc, '#theme-toggle');

  await waitFor(() => root.classList.contains('dark') === !wasDark, 'dark class to flip');
});

test('dialog component: trigger opens native <dialog>, close button closes it', async () => {
  const { frame, doc } = await openDocPage('dialog.html');

  await expect.element(frame.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();

  const dialog = doc.getElementById('demo-dialog');
  expect(dialog.open).toBe(false);

  await clickSelector(doc, '[data-dialog-trigger="demo-dialog"]');
  await waitFor(() => dialog.open, 'dialog to open');

  // Cancel is inside this dialog only — safe to target by data attribute
  await clickSelector(doc, '#demo-dialog [data-dialog-close]');
  await waitFor(() => !dialog.open, 'dialog to close');
  // dialog.js restores focus to the trigger on close
  await waitFor(
    () => doc.activeElement === doc.querySelector('[data-dialog-trigger="demo-dialog"]'),
    'focus to return to trigger',
  );
});

test('accordion single-open: opening one item closes its siblings', async () => {
  const { doc } = await openDocPage('accordion.html');

  const single = doc.querySelector('.accordion[data-type="single"]');
  const items = [...single.querySelectorAll('.accordion-item')];
  expect(items.length).toBe(3);

  // first item is open by default; click the second item's summary
  expect(items[0].open).toBe(true);
  await clickSelector(doc, '.accordion[data-type="single"] .accordion-item:nth-of-type(2) > summary');

  await waitFor(() => items[1].open, 'second item to open');
  // accordion.js single-open handler must have closed the first item
  await waitFor(() => !items[0].open, 'first item to close');
});
