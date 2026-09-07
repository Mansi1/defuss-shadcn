import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: site-header is CSS-only — the contract is that the flex header lays
 * out brand/nav/actions, the container query reveals the nav at wide
 * containers, and the sticky variant actually sticks. The nav composes the
 * navigation-menu component: trigger buttons with popovertarget + popover
 * panels, no header-side JS.
 */
await cssSmoke('site-header', [
  {
    label: 'inner row is a space-between flex bar, 56px min height',
    selector: '.mk-header-inner',
    css: { display: 'flex', 'justify-content': 'space-between', 'min-height': '56px' },
  },
  {
    label: 'brand icon is 20px and name uses primary color (≠ header bg)',
    distinct: [
      { selector: '.mk-header-name', prop: 'color' },
      { selector: '.mk-header', prop: 'background-color' },
    ],
  },
  {
    label: 'nav is visible at fixture width (container ≥ 30rem)',
    selector: '.mk-header-nav',
    css: { display: 'flex' },
  },
  {
    label: 'nav composes navigation-menu: trigger buttons + popover panels',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const nav = document.querySelector('.mk-header-nav')!;
        const triggers = [...nav.querySelectorAll('button.nav-menu-trigger[popovertarget]')];
        const panels = [...nav.querySelectorAll('div.nav-menu-content[popover]')];
        const linked = triggers.every((b) => panels.some((p) => p.id === b.getAttribute('popovertarget')));
        const pricing = !!nav.querySelector('a.nav-menu-link');
        return { triggers: triggers.length, panels: panels.length, linked, pricing };
      });
      if (r.triggers < 1 || r.panels < 1) throw new Error('nav lacks dropdown trigger/popover pairs');
      if (!r.linked) throw new Error('a popovertarget does not reference a panel in the header');
      if (!r.pricing) throw new Error('plain nav links missing');
    },
  },
  {
    label: 'dropdown opens natively on trigger click (Popover API, zero JS)',
    run: async (page) => {
      await page.click('.mk-header-nav button.nav-menu-trigger');
      const open = await page.evaluate(() => {
        const id = document.querySelector('.mk-header-nav button.nav-menu-trigger')!.getAttribute('popovertarget')!;
        return (document.getElementById(id) as HTMLDivElement).popover === 'auto';
      });
      if (!open) throw new Error('panel is not a native popover');
      await page.keyboard.press('Escape');
    },
  },
  {
    label: 'panel anchors below its trigger (nav carries .nav-menu so the anchor names are wired)',
    run: async (page) => {
      // the reported bug: without .nav-menu on the nav, navigation-menu.ts never
      // sets anchor names and the panel renders at the viewport top-left.
      await page.click('.mk-header-nav button.nav-menu-trigger');
      const r = await page.evaluate(() => {
        const t = document.querySelector('.mk-header-nav button.nav-menu-trigger')!;
        const id = t.getAttribute('popovertarget')!;
        const p = document.getElementById(id)!;
        return {
          posAnchor: getComputedStyle(p).positionAnchor,
          gap: p.getBoundingClientRect().top - t.getBoundingClientRect().bottom,
          aligned: Math.abs(p.getBoundingClientRect().left - t.getBoundingClientRect().left) < 2,
        };
      });
      await page.keyboard.press('Escape');
      if (r.posAnchor === 'normal') throw new Error('position-anchor not applied — nav is missing .nav-menu');
      if (!(r.gap >= 0 && r.gap < 24)) throw new Error(`panel ${r.gap}px from trigger bottom — not anchored below`);
      if (!r.aligned) throw new Error('panel left edge not aligned with trigger');
    },
  },
  {
    label: 'data-variant="sticky" pins the header',
    selector: '.mk-header[data-variant="sticky"]',
    css: { position: 'sticky', top: '0px' },
  },
]);
