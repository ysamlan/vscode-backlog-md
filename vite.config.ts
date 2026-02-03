import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite configuration for serving webview test pages
 *
 * This serves the webview HTML files in a standalone browser for Cypress testing.
 * The VS Code API is mocked by cypress/support/vscode-mock.ts
 *
 * Reference: Nx Console uses a similar pattern
 * https://github.com/nrwl/nx-console/tree/master/apps/generate-ui-v2-e2e
 */
export default defineConfig({
  root: 'cypress/webview-fixtures',
  publicDir: resolve(__dirname, 'cypress/fixtures'),
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, 'dist/webview-test'),
  },
});
