import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Why: a separate config (Vitest prefers vitest.config.* over vite.config.*)
 * so `vitest` does not inherit the doc-server `root: 'dist'`. Here root = repo
 * root, so the Vite server can serve both `tests/` and the real documentation
 * pages under `dist/documentation/` to the browser.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      // full desktop width so the doc-site sidebar is visible (not collapsed)
      viewport: { width: 1280, height: 900 },
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
