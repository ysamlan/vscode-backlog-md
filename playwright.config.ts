import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for webview E2E tests
 *
 * These tests verify webview UI functionality in isolation using a mocked
 * VS Code API, similar to how Cypress tests worked but with Playwright's
 * native drag-drop support and better ecosystem alignment with Svelte.
 *
 * Reference: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    // Base URL for webview test pages served by Vite
    baseURL: 'http://localhost:5173',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Match VS Code sidebar/panel dimensions
    viewport: { width: 400, height: 600 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Web server configuration - serves the webview test pages
  webServer: {
    // Use vite.config.ts which serves e2e/webview-fixtures with compiled Svelte bundles
    command: 'bun run vite',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  // Global timeout settings
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
});
