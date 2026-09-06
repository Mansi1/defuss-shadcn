/**
 * Why: Vitest browser-mode tests import source files with Vite's `?raw`
 * suffix (browser context has no node:fs). tsc only knows that specifier
 * through vite/client, which pulls in DOM-global conflicts with the bun
 * types the test tree uses — so the single contract we need is declared
 * explicitly instead.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
