import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
    screenshotOnRunFailure: true,
    // Increase timeout for webview loading
    defaultCommandTimeout: 10000,
    // Configure viewport to match VS Code sidebar/panel dimensions
    viewportWidth: 400,
    viewportHeight: 600,
  },
});
