/**
 * Why: every interactive component needs the same preamble (global registry +
 * `$` query alias). Single-sourced here instead of duplicated in 26 files;
 * scripts/build.ts inlines the compiled functions into each shipped component
 * .js so dist files stay isolated and copy-paste/CDN-ready. The function is
 * idempotent: whichever component loads first wins, the rest are no-ops.
 * Contract: AGENTS.md "State API"; types: src/types/defuss-shadcn.d.ts.
 */
export function defussGlobals(): DefussShadcnRegistry {
  globalThis._defussShadcn = globalThis._defussShadcn || {};
  if (typeof globalThis.$ !== 'function') globalThis.$ = document.querySelector.bind(document);
  return globalThis._defussShadcn;
}

/**
 * Why: calling showPopover() on a popover while its exit transition is still
 * running — the exact setState('open') path right after a light dismiss,
 * whose display:none is delayed by `transition: display … allow-discrete` —
 * crashes the headless renderer (reproduced: headless Chromium dies outright,
 * popover + nav-menu + dropdown + tooltip share the CSS pattern). Wait until
 * the element's computed display has actually flipped to none (the exit
 * committed), then show. A stable-open element polls to the cap and the
 * guarded showPopover() is a harmless no-op. Inlined by build.ts like
 * defussGlobals(); keep self-contained.
 */
export function safeShowPopover(el: HTMLElement): void {
  const show = (): void => {
    try { el.showPopover(); } catch { /* already open */ }
  };
  const displayed = (): boolean => getComputedStyle(el).display !== 'none';
  if (!displayed()) {
    show();
    return;
  }
  // displayed: either stably open (nothing to do) or mid-exit (must wait).
  // Cap the poll at ~500ms — longer than any component's exit transition.
  const deadline = performance.now() + 500;
  const tick = (): void => {
    if (!displayed() || performance.now() > deadline) show();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
