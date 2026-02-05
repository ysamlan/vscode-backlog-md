import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite configuration for serving webview test pages
 *
 * This serves the webview HTML files in a standalone browser for Cypress/Playwright testing.
 * The VS Code API is mocked by e2e/fixtures/vscode-mock.ts (Playwright) or
 * cypress/support/vscode-mock.ts (Cypress, legacy).
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
    // Allow serving files from dist/webview for compiled Svelte components
    fs: {
      allow: ['.', resolve(__dirname, 'dist')],
    },
  },
  resolve: {
    alias: {
      // Allow /dist/* imports to resolve to the workspace dist folder
      '/dist': resolve(__dirname, 'dist'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/webview-test'),
  },
});
