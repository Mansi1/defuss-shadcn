import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: brand-logos is CSS-only — the promise is that marks inherit
 * currentColor (muted-foreground) and scale up at the wide size step, with
 * the caption centered beneath the wrapping row.
 */
await cssSmoke('brand-logos', [
  {
    label: 'row wraps and centers, 40px marks at wide containers',
    selector: '.mk-logos-row',
    css: { display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'center' },
  },
  {
    label: 'logo mark renders 40px (2.5rem) at fixture width',
    selector: '.mk-logo svg',
    css: { width: '40px', height: '40px' },
  },
  {
    label: 'marks inherit the muted logo color (= --muted-foreground)',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('.mk-logo')!);
        const root = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim();
        // resolve the token through a probe element to compare serialized colors
        const probe = document.createElement('span');
        probe.style.color = root;
        document.body.appendChild(probe);
        const tokenColor = getComputedStyle(probe).color;
        probe.remove();
        return { logoColor: cs.color, tokenColor };
      });
      if (r.logoColor !== r.tokenColor)
        throw new Error(`logo color ${r.logoColor} != token ${r.tokenColor}`);
    },
  },
  {
    label: 'logo name is 20px medium (wide step)',
    selector: '.mk-logo-name',
    css: { 'font-size': '20px', 'font-weight': '500' },
  },
  {
    label: 'each mark is a real link to the brand site, unstyled until hover',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a.mk-logo')] as HTMLAnchorElement[];
        return {
          count: links.length,
          allHttp: links.every((a) => /^https:\/\//.test(a.href)),
          noUnderline: links.every((a) => getComputedStyle(a).textDecorationLine === 'none'),
          svgFilled: links.every((a) => getComputedStyle(a.querySelector('svg')!).fill !== 'none'),
        };
      });
      if (r.count < 4) throw new Error(`only ${r.count} linked logos`);
      if (!r.allHttp) throw new Error('a logo link is not an https URL');
      if (!r.noUnderline) throw new Error('logo links show underlines');
      if (!r.svgFilled) throw new Error('a brand mark is not filled (currentColor inheritance broken)');
    },
  },
  {
    label: 'caption is centered 14px muted text',
    selector: '.mk-logos-caption',
    css: { 'text-align': 'center', 'font-size': '14px' },
  },
]);
