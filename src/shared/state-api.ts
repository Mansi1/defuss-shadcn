/**
 * Why: every interactive component needs the same preamble (global registry +
 * `$` query alias). Single-sourced here instead of duplicated in 26 files;
 * scripts/build.ts inlines the compiled function into each shipped component
 * .js so dist files stay isolated and copy-paste/CDN-ready. The function is
 * idempotent: whichever component loads first wins, the rest are no-ops.
 * Contract: AGENTS.md "State API"; types: src/types/defuss-shadcn.d.ts.
 */
export function defussGlobals(): DefussShadcnRegistry {
  globalThis._defussShadcn = globalThis._defussShadcn || {};
  if (typeof globalThis.$ !== 'function') globalThis.$ = document.querySelector.bind(document);
  return globalThis._defussShadcn;
}
