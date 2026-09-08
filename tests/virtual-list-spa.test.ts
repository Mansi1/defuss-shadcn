import { describe, expect, it } from 'vitest';
import { openDocPage, waitFor } from './helpers.ts';

/**
 * Why: the router swaps main.innerHTML, and a <script> inserted that way never
 * executes — so demo code living in the page is dead on every navigation into
 * it, while looking perfectly fine when the page is opened by URL. The
 * virtual-list demos shipped that way once and rendered an empty list through
 * the sidebar. The wiring now lives in site.ts behind onPageReady; these tests
 * pin both halves of the fix.
 */

describe('virtual-list demos survive SPA navigation', () => {
  it('renders rows when the page is opened directly', async () => {
    const { doc } = await openDocPage('virtual-list.html');
    await waitFor(
      () => doc.querySelectorAll('#demo-virtual-list .virtual-list-row').length > 0,
      'rows on direct load',
    );
    const state = doc.querySelector<HTMLElement>('#demo-virtual-list')!.dataset.state;
    expect(state).toBe('default');
  });

  it('renders rows when the page is reached through the sidebar', async () => {
    const { doc } = await openDocPage('badge.html');

    doc.querySelector<HTMLAnchorElement>('.nav-link[href="virtual-list.html"]')!.click();

    await waitFor(() => doc.querySelector('#demo-virtual-list'), 'the virtual-list page content');
    await waitFor(
      () => doc.querySelectorAll('#demo-virtual-list .virtual-list-row').length > 0,
      'rows after navigating in',
    );
    expect(doc.querySelector<HTMLElement>('#demo-virtual-list')!.dataset.state).toBe('default');
  });

  it('renders the grid demo after navigating in', async () => {
    const { doc } = await openDocPage('badge.html');
    doc.querySelector<HTMLAnchorElement>('.nav-link[href="virtual-list.html"]')!.click();

    await waitFor(() => doc.querySelector('#demo-vl-grid'), 'the grid demo');
    await waitFor(
      () => doc.querySelectorAll('#demo-vl-grid .virtual-list-cell:not([hidden])').length >= 3,
      'grid cells after navigating in',
    );
  });

  it('keeps data set before the element is initialized', async () => {
    // setData can land before init() claims the element (that ordering is what
    // broke navigation); the stored count must survive initialization
    const { doc } = await openDocPage('virtual-list.html');
    const view = doc.defaultView as unknown as { _defussShadcn: Record<string, any> };

    const el = doc.createElement('div');
    el.className = 'virtual-list';
    el.setAttribute('aria-label', 'late init');
    el.style.height = '200px';
    doc.querySelector('main')!.appendChild(el);

    view._defussShadcn.virtualList.setData(el, 500, (row: HTMLElement, i: number) => {
      row.textContent = `late ${i}`;
    });

    await waitFor(() => el.querySelectorAll('.virtual-list-row').length > 0, 'rows after late init');
    expect((el as unknown as { _count: number })._count).toBe(500);
  });
});
