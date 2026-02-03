/**
 * Cypress e2e support file
 *
 * This file runs before each spec file and sets up global configuration.
 */

import { vscodeMock } from './vscode-mock';

// Make vscodeMock available globally for tests
declare global {
  interface Window {
    vscodeMock: typeof vscodeMock;
  }
}

// Add custom commands
Cypress.Commands.add('visitWebview', (webviewPath: string, options?: object) => {
  return cy.visit(webviewPath, {
    onBeforeLoad: (win) => {
      vscodeMock.install(win);
      // Expose mock to the test for assertions
      win.vscodeMock = vscodeMock;
    },
    ...options,
  });
});

Cypress.Commands.add('getPostedMessages', () => {
  return cy.window().then((win) => {
    return win.vscodeMock.getMessages();
  });
});

Cypress.Commands.add('getLastPostedMessage', () => {
  return cy.window().then((win) => {
    return win.vscodeMock.getLastMessage();
  });
});

Cypress.Commands.add('postMessageToWebview', (message: object) => {
  return cy.window().then((win) => {
    win.vscodeMock.postToWebview(message as Parameters<typeof vscodeMock.postToWebview>[0]);
  });
});

// Declare custom commands for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Visit a webview page with the VS Code API mock installed
       */
      visitWebview(webviewPath: string, options?: object): Chainable<void>;

      /**
       * Get all messages posted by the webview to the extension
       */
      getPostedMessages(): Chainable<Array<{ type: string; [key: string]: unknown }>>;

      /**
       * Get the last message posted by the webview
       */
      getLastPostedMessage(): Chainable<{ type: string; [key: string]: unknown } | undefined>;

      /**
       * Send a message to the webview (simulating extension -> webview)
       */
      postMessageToWebview(message: object): Chainable<void>;
    }
  }
}
