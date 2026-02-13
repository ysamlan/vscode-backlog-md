/**
 * CDP helper functions for evaluating JS, pressing keys, typing, and
 * taking screenshots.
 *
 * Extracted from scripts/screenshots/generate.ts.
 */

import * as fs from 'fs';
import { CdpClient } from './CdpClient';

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Evaluate a JS expression in the main page and return its value */
export async function cdpEval(cdp: CdpClient, expression: string): Promise<unknown> {
  const result = (await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })) as { result?: { value?: unknown }; exceptionDetails?: unknown };
  return result?.result?.value;
}

/** Send a key press via CDP Input.dispatchKeyEvent */
export async function cdpKeyPress(cdp: CdpClient, key: string): Promise<void> {
  const keyMap: Record<string, { key: string; code: string; keyCode: number }> = {
    F1: { key: 'F1', code: 'F1', keyCode: 112 },
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  };

  const mapped = keyMap[key];
  if (mapped) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: mapped.key,
      code: mapped.code,
      windowsVirtualKeyCode: mapped.keyCode,
      nativeVirtualKeyCode: mapped.keyCode,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: mapped.key,
      code: mapped.code,
      windowsVirtualKeyCode: mapped.keyCode,
      nativeVirtualKeyCode: mapped.keyCode,
    });
  } else if (key.length === 1) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      text: key,
      unmodifiedText: key,
      windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0),
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0),
    });
  }
}

/** Type a string character by character via CDP */
export async function cdpType(cdp: CdpClient, text: string, delayMs = 30): Promise<void> {
  for (const char of text) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: char,
      text: char,
      unmodifiedText: char,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: char,
    });
    await sleep(delayMs);
  }
}

/** Take a screenshot via CDP and save as PNG */
export async function cdpScreenshot(cdp: CdpClient, outputPath: string): Promise<void> {
  const result = (await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })) as { data: string };

  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const buffer = Buffer.from(result.data, 'base64');
  fs.writeFileSync(outputPath, buffer);
}

/** Open command palette (F1), type a command label, and press Enter */
export async function runCommand(cdp: CdpClient, commandLabel: string): Promise<void> {
  // Dismiss any existing command palette or dialog
  await cdpKeyPress(cdp, 'Escape');
  await sleep(200);
  // Open the command palette
  await cdpKeyPress(cdp, 'F1');
  await sleep(800);
  // Type the command name
  await cdpType(cdp, commandLabel, 40);
  await sleep(800);
  // Select the first match
  await cdpKeyPress(cdp, 'Enter');
  await sleep(1000);
}

/** Dismiss any notification toasts */
export async function dismissNotifications(cdp: CdpClient): Promise<void> {
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notification-toast .codicon-close, .notifications-toasts .codicon-notifications-clear-all').forEach(el => el.click())`
  );
  await sleep(300);
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notification-list-item .codicon-close').forEach(el => el.click())`
  );
  await sleep(300);
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notifications-center .codicon-close').forEach(el => el.click())`
  );
  await sleep(200);
}

/** Close all open editors via keyboard shortcut */
export async function resetEditorState(cdp: CdpClient): Promise<void> {
  await cdpKeyPress(cdp, 'Escape');
  await sleep(200);
  // Ctrl+K then Ctrl+W to close all editors
  const mod = process.platform === 'darwin' ? 4 : 2;
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'k',
    code: 'KeyK',
    windowsVirtualKeyCode: 75,
    modifiers: mod,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'k',
    code: 'KeyK',
    modifiers: mod,
  });
  await sleep(200);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'w',
    code: 'KeyW',
    windowsVirtualKeyCode: 87,
    modifiers: mod,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'w',
    code: 'KeyW',
    modifiers: mod,
  });
  await sleep(500);
}
