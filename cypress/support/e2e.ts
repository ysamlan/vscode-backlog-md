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

/**
 * Custom drag command for HTML5 drag-and-drop testing
 * Simulates dragging an element to a target location
 */
Cypress.Commands.add(
  'drag',
  { prevSubject: 'element' },
  (subject, targetSelector: string, options?: { target?: { x: number; y: number } }) => {
    const dataTransfer = new DataTransfer();

    // Get the source element
    cy.wrap(subject)
      .trigger('dragstart', { dataTransfer, force: true })
      .then(() => {
        // Get the target element or position
        if (options?.target) {
          // Drag to specific coordinates within the target
          cy.get(targetSelector).then(($target) => {
            const targetRect = $target[0].getBoundingClientRect();
            const clientX = targetRect.left + (options.target?.x || 0);
            const clientY = targetRect.top + (options.target?.y || 0);

            cy.get(targetSelector)
              .trigger('dragover', { dataTransfer, clientX, clientY, force: true })
              .trigger('drop', { dataTransfer, clientX, clientY, force: true });
          });
        } else {
          // Drag to center of target element
          cy.get(targetSelector)
            .trigger('dragover', { dataTransfer, force: true })
            .trigger('drop', { dataTransfer, force: true });
        }
      })
      .then(() => {
        cy.wrap(subject).trigger('dragend', { dataTransfer, force: true });
      });
  }
);

// Declare custom commands for TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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

      /**
       * Drag an element to a target element or position
       * @param targetSelector - CSS selector for the drop target
       * @param options - Optional target coordinates within the element
       */
      drag(
        targetSelector: string,
        options?: { target?: { x: number; y: number } }
      ): Chainable<JQuery<HTMLElement>>;
    }
  }
}
