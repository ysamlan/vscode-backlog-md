/**
 * VS Code API Mock for Cypress standalone webview testing
 *
 * This mock implements the acquireVsCodeApi() function that webviews use to
 * communicate with the VS Code extension host. In tests, messages are captured
 * and can be inspected/responded to.
 *
 * Reference implementations:
 * - Nx Console: https://github.com/nrwl/nx-console/blob/master/apps/generate-ui-v2-e2e/src/support/visit-generate-ui.ts
 * - wdio-vscode-service: https://github.com/webdriverio-community/wdio-vscode-service
 */

export interface VsCodeMessage {
  type: string;
  [key: string]: unknown;
}

export interface MockVsCodeApi {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

/**
 * Messages sent from webview to extension
 */
const postedMessages: VsCodeMessage[] = [];

/**
 * Callbacks registered to receive messages from extension to webview
 */
const messageListeners: Array<(event: MessageEvent) => void> = [];

/**
 * State stored by the webview
 */
let webviewState: unknown = undefined;

/**
 * Mock implementation of acquireVsCodeApi()
 */
function createMockVsCodeApi(): MockVsCodeApi {
  return {
    postMessage: (message: VsCodeMessage) => {
      console.log('[vscode-mock] postMessage:', message);
      postedMessages.push(message);
    },
    getState: () => webviewState,
    setState: (state: unknown) => {
      webviewState = state;
    },
  };
}

/**
 * Send a message to the webview (simulating extension -> webview communication)
 */
export function postMessageToWebview(message: VsCodeMessage): void {
  console.log('[vscode-mock] Sending message to webview:', message);
  const event = new MessageEvent('message', { data: message });
  messageListeners.forEach((listener) => listener(event));
  window.dispatchEvent(event);
}

/**
 * Get all messages posted by the webview
 */
export function getPostedMessages(): VsCodeMessage[] {
  return [...postedMessages];
}

/**
 * Clear posted messages (call before each test)
 */
export function clearPostedMessages(): void {
  postedMessages.length = 0;
}

/**
 * Get the last message posted by the webview
 */
export function getLastPostedMessage(): VsCodeMessage | undefined {
  return postedMessages[postedMessages.length - 1];
}

/**
 * Wait for a message of a specific type to be posted
 */
export function waitForMessage(type: string, timeout = 5000): Promise<VsCodeMessage> {
  return new Promise((resolve, reject) => {
    const startLength = postedMessages.length;
    const checkInterval = setInterval(() => {
      for (let i = startLength; i < postedMessages.length; i++) {
        if (postedMessages[i].type === type) {
          clearInterval(checkInterval);
          resolve(postedMessages[i]);
          return;
        }
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);
  });
}

/**
 * Install the mock on the window object
 * Call this in onBeforeLoad when visiting the page
 */
export function installVsCodeMock(win: Window): void {
  // Clear state from previous tests
  clearPostedMessages();
  webviewState = undefined;

  // Install acquireVsCodeApi
  (win as unknown as { acquireVsCodeApi: () => MockVsCodeApi }).acquireVsCodeApi =
    createMockVsCodeApi;

  // Capture message event listeners
  const originalAddEventListener = win.addEventListener.bind(win);
  win.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    if (type === 'message' && typeof listener === 'function') {
      messageListeners.push(listener as (event: MessageEvent) => void);
    }
    return originalAddEventListener(type, listener, options);
  }) as typeof win.addEventListener;
}

// Export for use in Cypress commands
export const vscodeMock = {
  install: installVsCodeMock,
  postToWebview: postMessageToWebview,
  getMessages: getPostedMessages,
  getLastMessage: getLastPostedMessage,
  clearMessages: clearPostedMessages,
  waitForMessage,
};
