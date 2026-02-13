/**
 * Wait/retry utilities for CDP-based tests.
 */

import { CdpClient } from './CdpClient';
import { cdpEval, sleep, dismissNotifications, executeCommand } from './cdp-helpers';
import { getWebviewTextContent, type WebviewRole } from './webview-helpers';

interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  /** Description for error messages */
  label?: string;
}

/**
 * Generic retry wrapper: calls `fn` up to `attempts` times with `delayMs` between tries.
 * Returns the first truthy result, or throws after exhausting all attempts.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 10, delayMs = 1000, label = 'operation' } = opts;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
    await sleep(delayMs);
  }

  throw new Error(`${label} did not succeed after ${attempts} attempts`);
}

/**
 * Wait for VS Code's workbench to be fully loaded.
 */
export async function waitForWorkbench(cdp: CdpClient, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await cdpEval(
      cdp,
      `!!document.querySelector('.monaco-workbench') && !!document.querySelector('.activitybar')`
    );
    if (ready) return;
    await sleep(300);
  }
  throw new Error(`Workbench not ready after ${timeoutMs}ms`);
}

/**
 * Wait for the extension to activate (Backlog sidebar has task content).
 */
export async function waitForExtensionReady(cdp: CdpClient, timeoutMs = 60_000): Promise<void> {
  // First wait for workbench
  await waitForWorkbench(cdp);
  await dismissNotifications(cdp);

  // Close secondary sidebar (chat/copilot panel) if open
  await cdpEval(
    cdp,
    `(() => {
      const auxBar = document.querySelector('.part.auxiliarybar');
      if (auxBar && getComputedStyle(auxBar).display !== 'none') {
        const toggleBtn = document.querySelector('.codicon-layout-sidebar-right-off, .codicon-layout-sidebar-right');
        if (toggleBtn) toggleBtn.closest('.action-item')?.querySelector('a')?.click();
      }
    })()`
  );
  await sleep(300);

  // Focus the Backlog sidebar by clicking its activity bar icon.
  await cdpEval(
    cdp,
    `(() => {
      const items = document.querySelectorAll('.activitybar .action-item a');
      for (const item of items) {
        const label = item.getAttribute('aria-label') || item.getAttribute('title') || '';
        if (label.includes('Backlog')) {
          item.click();
          return true;
        }
      }
      return false;
    })()`
  );

  // Open kanban via keybinding (much faster than command palette)
  await sleep(500);
  await executeCommand(cdp, 'backlog.openKanban');

  // Wait for extension to load tasks in the sidebar or webview
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasContent = await cdpEval(
      cdp,
      `document.querySelector('.pane-body')?.textContent?.includes('TASK-') ?? false`
    );
    if (hasContent) {
      await sleep(500);
      return;
    }

    const hasWebviewContent = await getWebviewTextContent(cdp, 'tasks').catch(() => null);
    if (hasWebviewContent?.includes('TASK-')) {
      await sleep(500);
      return;
    }

    await sleep(300);
  }
  throw new Error(`Extension did not activate within ${timeoutMs}ms`);
}

/**
 * Wait until a webview with the given role contains text matching the predicate.
 */
export async function waitForWebviewContent(
  cdp: CdpClient,
  role: WebviewRole,
  matcher: string | ((text: string) => boolean),
  opts: { timeoutMs?: number; pollMs?: number } = {}
): Promise<string> {
  const { timeoutMs = 15_000, pollMs = 200 } = opts;
  const matchFn = typeof matcher === 'string' ? (t: string) => t.includes(matcher) : matcher;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await getWebviewTextContent(cdp, role);
    if (text && matchFn(text)) return text;
    await sleep(pollMs);
  }
  throw new Error(`Webview "${role}" did not contain expected content within ${timeoutMs}ms`);
}

/**
 * Wait for a task file on disk to contain specific text.
 */
export async function waitForFileContent(
  filePath: string,
  matcher: string | ((content: string) => boolean),
  opts: { timeoutMs?: number; pollMs?: number } = {}
): Promise<string> {
  const { timeoutMs = 15_000, pollMs = 200 } = opts;
  const matchFn = typeof matcher === 'string' ? (t: string) => t.includes(matcher) : matcher;
  const fs = await import('fs');

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (matchFn(content)) return content;
    } catch {
      // File may not exist yet
    }
    await sleep(pollMs);
  }
  throw new Error(`File "${filePath}" did not contain expected content within ${timeoutMs}ms`);
}
