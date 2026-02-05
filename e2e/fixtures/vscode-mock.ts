/**
 * VS Code API Mock for Playwright webview testing
 *
 * This mock implements the acquireVsCodeApi() function that webviews use to
 * communicate with the VS Code extension host. In tests, messages are captured
 * and can be inspected/responded to.
 *
 * Ported from: cypress/support/vscode-mock.ts
 *
 * Usage in Playwright tests:
 *
 *   import { installVsCodeMock, getPostedMessages, postMessageToWebview } from './fixtures/vscode-mock';
 *
 *   test('sends message on button click', async ({ page }) => {
 *     await installVsCodeMock(page);
 *     await page.goto('/kanban.html');
 *
 *     await page.click('[data-cy="some-button"]');
 *
 *     const messages = await getPostedMessages(page);
 *     expect(messages).toContainEqual({ type: 'someAction' });
 *   });
 */

import type { Page } from '@playwright/test';

export interface VsCodeMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Install the VS Code API mock on a page before navigation.
 * Must be called before page.goto().
 */
export async function installVsCodeMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Storage for captured messages and state
    const postedMessages: Array<{ type: string; [key: string]: unknown }> = [];
    let webviewState: unknown = undefined;

    // Mock implementation of acquireVsCodeApi
    function createMockVsCodeApi() {
      return {
        postMessage: (message: { type: string; [key: string]: unknown }) => {
          console.log('[vscode-mock] postMessage:', message);
          postedMessages.push(message);
        },
        getState: () => webviewState,
        setState: (state: unknown) => {
          webviewState = state;
          return state;
        },
      };
    }

    // Install on window
    (
      window as unknown as { acquireVsCodeApi: () => ReturnType<typeof createMockVsCodeApi> }
    ).acquireVsCodeApi = createMockVsCodeApi;

    // Also install on __vscodeMock for the Svelte bridge fallback
    (window as unknown as { __vscodeMock: ReturnType<typeof createMockVsCodeApi> }).__vscodeMock =
      createMockVsCodeApi();

    // Expose helper functions for test access
    (
      window as unknown as {
        __vscodeTestHelpers: {
          getPostedMessages: () => typeof postedMessages;
          clearPostedMessages: () => void;
          getLastPostedMessage: () => (typeof postedMessages)[number] | undefined;
          getState: () => unknown;
        };
      }
    ).__vscodeTestHelpers = {
      getPostedMessages: () => [...postedMessages],
      clearPostedMessages: () => {
        postedMessages.length = 0;
      },
      getLastPostedMessage: () => postedMessages[postedMessages.length - 1],
      getState: () => webviewState,
    };
  });
}

/**
 * Get all messages posted by the webview to the extension
 */
export async function getPostedMessages(page: Page): Promise<VsCodeMessage[]> {
  return await page.evaluate(() => {
    const helpers = (
      window as unknown as { __vscodeTestHelpers: { getPostedMessages: () => VsCodeMessage[] } }
    ).__vscodeTestHelpers;
    return helpers.getPostedMessages();
  });
}

/**
 * Get the last message posted by the webview
 */
export async function getLastPostedMessage(page: Page): Promise<VsCodeMessage | undefined> {
  return await page.evaluate(() => {
    const helpers = (
      window as unknown as {
        __vscodeTestHelpers: { getLastPostedMessage: () => VsCodeMessage | undefined };
      }
    ).__vscodeTestHelpers;
    return helpers.getLastPostedMessage();
  });
}

/**
 * Clear all posted messages (call before each test interaction)
 */
export async function clearPostedMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const helpers = (
      window as unknown as { __vscodeTestHelpers: { clearPostedMessages: () => void } }
    ).__vscodeTestHelpers;
    helpers.clearPostedMessages();
  });
}

/**
 * Send a message to the webview (simulating extension -> webview communication)
 */
export async function postMessageToWebview(page: Page, message: VsCodeMessage): Promise<void> {
  await page.evaluate((msg) => {
    console.log('[vscode-mock] Sending message to webview:', msg);
    window.dispatchEvent(new MessageEvent('message', { data: msg }));
  }, message);
}

/**
 * Wait for a specific message type to be posted by the webview
 */
export async function waitForMessage(
  page: Page,
  type: string,
  options: { timeout?: number } = {}
): Promise<VsCodeMessage> {
  const { timeout = 5000 } = options;

  return await page.evaluate(
    ({ type, timeout }) => {
      return new Promise<{ type: string; [key: string]: unknown }>((resolve, reject) => {
        const helpers = (
          window as unknown as {
            __vscodeTestHelpers: {
              getPostedMessages: () => Array<{ type: string; [key: string]: unknown }>;
            };
          }
        ).__vscodeTestHelpers;
        const startLength = helpers.getPostedMessages().length;

        const checkInterval = setInterval(() => {
          const messages = helpers.getPostedMessages();
          for (let i = startLength; i < messages.length; i++) {
            if (messages[i].type === type) {
              clearInterval(checkInterval);
              resolve(messages[i]);
              return;
            }
          }
        }, 50);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for message type: ${type}`));
        }, timeout);
      });
    },
    { type, timeout }
  );
}
