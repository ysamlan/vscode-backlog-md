/**
 * VS Code API Bridge for Svelte Webviews
 *
 * This module provides a Svelte 5 runes-based interface for communicating
 * between webview UI and the VS Code extension host.
 *
 * Usage:
 *   import { vscode, onMessage } from './stores/vscode.svelte';
 *
 *   // Send message to extension
 *   vscode.postMessage({ type: 'updateField', field: 'status', value: 'Done' });
 *
 *   // Listen for messages from extension
 *   onMessage((msg) => {
 *     if (msg.type === 'updateTask') { ... }
 *   });
 */

export interface VsCodeMessage {
  type: string;
  [key: string]: unknown;
}

interface VsCodeApi {
  postMessage: (message: VsCodeMessage) => void;
  getState: <T>() => T | undefined;
  setState: <T>(state: T) => T;
}

// Declare the global acquireVsCodeApi function that VS Code injects
declare function acquireVsCodeApi(): VsCodeApi;

/**
 * Get the VS Code API instance.
 * In production, this calls acquireVsCodeApi() (can only be called once).
 * In tests, this returns a mock implementation.
 */
function getVsCodeApi(): VsCodeApi {
  // Check if we're in a VS Code webview context
  if (typeof acquireVsCodeApi === 'function') {
    return acquireVsCodeApi();
  }

  // Fallback for standalone testing (Playwright/Vitest)
  // The test harness should have installed a mock on window
  const windowWithMock = window as unknown as { __vscodeMock?: VsCodeApi };
  if (windowWithMock.__vscodeMock) {
    return windowWithMock.__vscodeMock;
  }

  // Development fallback - log messages to console
  console.warn('[vscode.svelte.ts] No VS Code API available, using console fallback');
  return {
    postMessage: (message: VsCodeMessage) => {
      console.log('[vscode-mock] postMessage:', message);
    },
    getState: () => undefined,
    setState: (state) => state,
  };
}

// Singleton VS Code API instance
let vsCodeApiInstance: VsCodeApi | null = null;

function getApi(): VsCodeApi {
  if (!vsCodeApiInstance) {
    vsCodeApiInstance = getVsCodeApi();
  }
  return vsCodeApiInstance;
}

/**
 * VS Code API wrapper with reactive state management
 */
export const vscode = {
  /**
   * Send a message to the extension host
   */
  postMessage(message: VsCodeMessage): void {
    getApi().postMessage(message);
  },

  /**
   * Get persisted webview state
   */
  getState<T>(): T | undefined {
    return getApi().getState<T>();
  },

  /**
   * Persist webview state (survives webview being hidden/shown)
   */
  setState<T>(state: T): T {
    return getApi().setState(state);
  },
};

// Message listeners
type MessageHandler = (message: VsCodeMessage) => void;
const messageHandlers: Set<MessageHandler> = new Set();
let isListenerInstalled = false;

/**
 * Install the global message listener (called once)
 */
function installMessageListener(): void {
  if (isListenerInstalled) return;
  isListenerInstalled = true;

  window.addEventListener('message', (event: MessageEvent<VsCodeMessage>) => {
    const message = event.data;
    messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('[vscode.svelte.ts] Error in message handler:', error);
      }
    });
  });
}

/**
 * Register a handler for messages from the extension host.
 * Returns an unsubscribe function.
 *
 * @example
 * import { onMessage } from './stores/vscode.svelte';
 *
 * const unsubscribe = onMessage((msg) => {
 *   if (msg.type === 'updateTask') {
 *     task = msg.task;
 *   }
 * });
 *
 * // Later, to clean up:
 * unsubscribe();
 */
export function onMessage(handler: MessageHandler): () => void {
  installMessageListener();
  messageHandlers.add(handler);

  return () => {
    messageHandlers.delete(handler);
  };
}

/**
 * Send a message and wait for a response of a specific type.
 * Useful for request/response patterns.
 *
 * @example
 * const response = await requestMessage(
 *   { type: 'getTask', taskId: 'TASK-1' },
 *   'taskData',
 *   5000
 * );
 */
export function requestMessage(
  request: VsCodeMessage,
  responseType: string,
  timeout = 5000
): Promise<VsCodeMessage> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for response type: ${responseType}`));
    }, timeout);

    const unsubscribe = onMessage((message) => {
      if (message.type === responseType) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(message);
      }
    });

    vscode.postMessage(request);
  });
}

// For testing: allow resetting the singleton
export function __resetForTesting(): void {
  vsCodeApiInstance = null;
  messageHandlers.clear();
  isListenerInstalled = false;
}
