#!/usr/bin/env bun
/**
 * Screenshot Generation Orchestrator
 *
 * Launches VS Code as a child process with --remote-debugging-port, connects
 * via raw CDP (Chrome DevTools Protocol) over WebSocket, navigates to each
 * screenshot scenario, captures at 2x DPI, adds synthetic macOS window
 * chrome, and optimizes with oxipng.
 *
 * Uses direct CDP instead of Playwright's electron.launch() because VS Code's
 * Electron build strips the --remote-debugging-pipe flag that Playwright needs.
 *
 * Usage:
 *   bun scripts/screenshots/generate.ts [--theme dark|light|all] [--scenario name] [--skip-chrome] [--skip-optimize]
 */

import { spawn, execSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { scenarios, themes, type ScreenshotScenario, type ThemeId } from './scenarios';
import { addWindowChrome, addPanelFrame } from './window-chrome';

// --- Configuration ---

const PROJECT_ROOT = path.resolve(import.meta.dir, '../..');
const WORKSPACE_PATH = path.join(PROJECT_ROOT, 'src/test/e2e/fixtures/test-workspace');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/images');
const RAW_DIR = path.join(PROJECT_ROOT, '.vscode-test/screenshots/raw');

/** Window size at 1x (will be doubled for 2x DPI output) */
const WINDOW_WIDTH = 1553;
const WINDOW_HEIGHT = 1043;

/** Default sidebar width at 1x if not specified by scenario */
const DEFAULT_SIDEBAR_WIDTH = 380;

/** Base port for CDP debugging (incremented per launch to avoid conflicts) */
let nextCdpPort = 9334;

// --- CLI Arguments ---

interface CliOptions {
  themes: ThemeId[];
  scenarioFilter: string | null;
  skipChrome: boolean;
  skipOptimize: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    themes: ['dark', 'light'],
    scenarioFilter: null,
    skipChrome: false,
    skipOptimize: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--theme':
        {
          const val = args[++i];
          if (val === 'dark' || val === 'light') opts.themes = [val];
          else if (val === 'all') opts.themes = ['dark', 'light'];
          else {
            console.error(`Invalid theme: ${val}. Use dark, light, or all.`);
            process.exit(1);
          }
        }
        break;
      case '--scenario':
        opts.scenarioFilter = args[++i];
        break;
      case '--skip-chrome':
        opts.skipChrome = true;
        break;
      case '--skip-optimize':
        opts.skipOptimize = true;
        break;
    }
  }

  return opts;
}

// --- VS Code Binary Detection ---

function findVsCodeBinary(): string {
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';

  // Check for local .vscode-test installation (platform-aware to avoid
  // picking up cross-platform binaries in shared devcontainer mounts)
  if (isMac) {
    const macBin = path.join(
      PROJECT_ROOT,
      '.vscode-test/Visual Studio Code.app/Contents/MacOS/Electron'
    );
    if (fs.existsSync(macBin)) return macBin;
  }

  if (isLinux) {
    const linuxBin = path.join(PROJECT_ROOT, '.vscode-test/VSCode-linux-x64/code');
    if (fs.existsSync(linuxBin)) return linuxBin;
  }

  // Try system VS Code as fallback
  try {
    const systemCode = execSync('which code', { encoding: 'utf-8' }).trim();
    const resolved = fs.realpathSync(systemCode);
    if (isMac) {
      const electronBin = path.join(path.dirname(resolved), '..', 'MacOS', 'Electron');
      if (fs.existsSync(electronBin)) return electronBin;
    }
    return resolved;
  } catch {
    // No system VS Code
  }

  console.error(
    `Could not find VS Code binary for ${process.platform}. ` +
      'Run "bun run test:e2e" first to download it.'
  );
  process.exit(1);
}

// --- Settings Management ---

/** Each theme gets its own user-data-dir to avoid cached theme state */
function getSettingsDir(themeId: string): string {
  return path.join(PROJECT_ROOT, `.vscode-test/settings/screenshots-${themeId}`);
}

function writeSettings(themeId: string, themeSetting: string): void {
  const settingsDir = getSettingsDir(themeId);
  const userDataDir = path.join(settingsDir, 'User');
  fs.mkdirSync(userDataDir, { recursive: true });

  const settings = {
    'workbench.colorTheme': themeSetting,
    'window.titleBarStyle': 'custom',
    'window.menuBarVisibility': 'hidden',
    'workbench.startupEditor': 'none',
    'extensions.autoUpdate': false,
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none',
    'window.restoreWindows': 'none',
    'workbench.tips.enabled': false,
    'workbench.enableExperiments': false,
    'git.enabled': false,
    'editor.minimap.enabled': false,
    'breadcrumbs.enabled': false,
    'editor.renderWhitespace': 'none',
    'editor.lineNumbers': 'on',
    'workbench.activityBar.location': 'side',
    'editor.fontSize': 13,
    'extensions.ignoreRecommendations': true,
    // Disable chat/copilot panels
    'chat.commandCenter.enabled': false,
    'chat.editor.enabled': false,
  };

  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify(settings, null, 2));
}

// --- CDP (Chrome DevTools Protocol) Client ---

/** Minimal CDP client over WebSocket, with session support for iframe targets */
class CdpClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`WebSocket connection failed: ${wsUrl}`));
      ws.onmessage = (event) => {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws) throw new Error('Not connected');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, 15000);
    });
  }

  /** Send a CDP command to an attached session (for iframe targets) */
  async sendToSession(
    sessionId: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.ws) throw new Error('Not connected');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP session command timeout: ${method}`));
        }
      }, 15000);
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

// --- VS Code Launch & CDP Connection ---

interface VsCodeInstance {
  proc: ChildProcess;
  cdp: CdpClient;
  cdpPort: number;
}

async function waitForCdpReady(port: number, timeoutMs = 30000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = (await resp.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
      const page = list.find((e) => e.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`CDP not ready after ${timeoutMs}ms on port ${port}`);
}

async function launchVsCode(themeId: string, themeSetting: string): Promise<VsCodeInstance> {
  const binary = findVsCodeBinary();
  const settingsDir = getSettingsDir(themeId);
  const cdpPort = nextCdpPort++;

  // Nuke the entire user-data-dir to eliminate ALL cached theme state.
  // VS Code stores theme in IndexedDB (state.vscdb), globalStorage/storage.json,
  // and other internal caches — cleaning just globalStorage is not enough.
  if (fs.existsSync(settingsDir)) {
    fs.rmSync(settingsDir, { recursive: true, force: true });
  }

  writeSettings(themeId, themeSetting);

  console.log(`  Launching VS Code (${path.basename(binary)}) on CDP port ${cdpPort}...`);

  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  if (process.platform === 'linux') {
    env.ELECTRON_DISABLE_GPU = '1';
  }

  const proc = spawn(
    binary,
    [
      WORKSPACE_PATH,
      '--extensionDevelopmentPath=' + PROJECT_ROOT,
      '--user-data-dir=' + settingsDir,
      '--disable-extensions',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      '--force-device-scale-factor=2',
      '--no-sandbox',
      `--remote-debugging-port=${cdpPort}`,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    }
  );

  proc.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.includes('DevTools listening')) {
      console.log(`  ${line.trim()}`);
    }
  });

  console.log('  Waiting for CDP endpoint...');
  const pageWsUrl = await waitForCdpReady(cdpPort);
  console.log('  CDP ready, connecting...');

  const cdp = new CdpClient();
  await cdp.connect(pageWsUrl);
  console.log('  Connected to VS Code via CDP.');

  return { proc, cdp, cdpPort };
}

function closeVsCode(instance: VsCodeInstance): void {
  instance.cdp.close();
  instance.proc.kill();
}

// --- CDP Helpers ---

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function cdpEval(cdp: CdpClient, expression: string): Promise<unknown> {
  const result = (await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })) as { result?: { value?: unknown }; exceptionDetails?: unknown };
  return result?.result?.value;
}

/** Send a key press via CDP Input.dispatchKeyEvent */
async function cdpKeyPress(cdp: CdpClient, key: string): Promise<void> {
  const keyMap: Record<string, { key: string; code: string; keyCode: number }> = {
    F1: { key: 'F1', code: 'F1', keyCode: 112 },
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
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
async function cdpType(cdp: CdpClient, text: string, delayMs = 30): Promise<void> {
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
async function cdpScreenshot(cdp: CdpClient, outputPath: string): Promise<void> {
  const result = (await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })) as { data: string };

  const buffer = Buffer.from(result.data, 'base64');
  fs.writeFileSync(outputPath, buffer);
}

/** Set the browser window size via JS fallback */
async function cdpSetViewport(cdp: CdpClient): Promise<void> {
  try {
    const target = (await cdp.send('Browser.getWindowForTarget')) as { windowId: number };
    await cdp.send('Browser.setWindowBounds', {
      windowId: target.windowId,
      bounds: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT },
    });
  } catch {
    await cdpEval(cdp, `window.resizeTo(${WINDOW_WIDTH}, ${WINDOW_HEIGHT})`);
  }
}

/** Wait for VS Code's workbench to be fully loaded */
async function waitForVsCodeReady(cdp: CdpClient): Promise<void> {
  console.log('  Waiting for VS Code workbench...');
  const start = Date.now();
  const timeout = 30000;

  while (Date.now() - start < timeout) {
    const ready = await cdpEval(
      cdp,
      `!!document.querySelector('.monaco-workbench') && !!document.querySelector('.activitybar')`
    );
    if (ready) {
      console.log(`  Workbench ready (${Date.now() - start}ms).`);
      break;
    }
    await sleep(500);
  }

  // Wait for extension to fully activate (tasks need to be parsed)
  console.log('  Waiting for extension to activate...');
  const extStart = Date.now();
  while (Date.now() - extStart < 20000) {
    // Check if the Backlog sidebar has task content
    const hasContent = await cdpEval(
      cdp,
      `document.querySelector('.pane-body')?.textContent?.includes('TASK-') ?? false`
    );
    if (hasContent) {
      console.log(`  Extension activated (${Date.now() - extStart}ms).`);
      break;
    }
    await sleep(500);
  }

  // Close the secondary sidebar (chat/copilot panel) if open
  // Check if any secondary sidebar / auxiliary bar is visible and close it via DOM
  await cdpEval(
    cdp,
    `(() => {
      // Try to close the auxiliary bar (Copilot/Chat) by clicking its close button
      const auxBar = document.querySelector('.part.auxiliarybar');
      if (auxBar && getComputedStyle(auxBar).display !== 'none') {
        // Click the toggle button in the activity bar to hide it
        const toggleBtn = document.querySelector('.codicon-layout-sidebar-right-off, .codicon-layout-sidebar-right');
        if (toggleBtn) toggleBtn.closest('.action-item')?.querySelector('a')?.click();
      }
    })()`
  );
  await sleep(500);

  // Extra settle time for webview rendering
  await sleep(2000);
}

/** Dismiss any notification toasts (like "extensions disabled") */
async function dismissNotifications(cdp: CdpClient): Promise<void> {
  // Close individual notification toasts
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notification-toast .codicon-close, .notifications-toasts .codicon-notifications-clear-all').forEach(el => el.click())`
  );
  await sleep(300);
  // Also try notification center items
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notification-list-item .codicon-close').forEach(el => el.click())`
  );
  await sleep(300);
  // Hide the notification center if visible
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notifications-center .codicon-close').forEach(el => el.click())`
  );
  await sleep(200);
}

// --- Panel Cropping ---

/** Get the bounding rectangle of a panel element for cropping */
async function getCropBounds(
  cdp: CdpClient,
  crop: 'sidebar' | 'editor'
): Promise<{ left: number; top: number; width: number; height: number } | null> {
  const selector = crop === 'sidebar' ? '.part.sidebar' : '.editor-group-container';
  const bounds = (await cdpEval(
    cdp,
    `(() => {
      const el = document.querySelector('${selector}');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    })()`
  )) as { x: number; y: number; width: number; height: number } | null;

  if (!bounds || bounds.width === 0 || bounds.height === 0) return null;

  // Multiply by 2 for 2x DPI screenshots
  return {
    left: bounds.x * 2,
    top: bounds.y * 2,
    width: bounds.width * 2,
    height: bounds.height * 2,
  };
}

/** Crop a screenshot to the given bounds using sharp */
async function cropImage(
  imagePath: string,
  bounds: { left: number; top: number; width: number; height: number }
): Promise<void> {
  const { default: sharpModule } = await import('sharp');
  const buffer = await sharpModule(imagePath).extract(bounds).png().toBuffer();
  fs.writeFileSync(imagePath, buffer);
}

// --- Sidebar Width ---

/**
 * Widen the sidebar by simulating a drag on the sash (resize handle).
 * Uses CDP Input.dispatchMouseEvent to drag the vertical sash to the desired position.
 */
async function widenSidebar(cdp: CdpClient, targetWidthLogical: number): Promise<void> {
  // At 2x DPI, logical pixels are doubled in the viewport
  const targetWidth2x = targetWidthLogical * 2;

  // Find the vertical sash position (the border between sidebar and editor)
  const sashInfo = (await cdpEval(
    cdp,
    `(() => {
      // VS Code's sash elements are the resize handles between panels.
      // Find the sidebar/editor boundary sash - it's the first vertical sash
      // after the activity bar (activity bar is ~96px wide at 2x).
      const sashes = [...document.querySelectorAll('.monaco-sash.vertical')]
        .map(s => ({ el: s, rect: s.getBoundingClientRect() }))
        .filter(s => s.rect.left > 50 && s.rect.height > 200)
        .sort((a, b) => a.rect.left - b.rect.left);
      // The first sash after the activity bar is the sidebar boundary
      if (sashes.length > 0) {
        const sash = sashes[0];
        return { x: sash.rect.left + sash.rect.width / 2, y: sash.rect.top + sash.rect.height / 2, found: true };
      }
      return { found: false };
    })()`
  )) as { x?: number; y?: number; found: boolean } | null;

  if (!sashInfo?.found || !sashInfo.x || !sashInfo.y) {
    console.log('    Could not find sidebar sash, skipping width adjustment');
    return;
  }

  console.log(`    Dragging sidebar sash from ${Math.round(sashInfo.x)}px to ${targetWidth2x}px`);

  // Simulate mouse drag: mousedown → mousemove → mouseup
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: sashInfo.x,
    y: sashInfo.y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(50);

  // Move in steps for smoother resize
  const steps = 5;
  const startX = sashInfo.x;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((targetWidth2x - startX) * i) / steps;
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y: sashInfo.y,
      button: 'left',
    });
    await sleep(20);
  }

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: targetWidth2x,
    y: sashInfo.y,
    button: 'left',
    clickCount: 1,
  });

  await sleep(300);
}

// --- Webview Interaction via CDP ---

/**
 * Select a task in the webview by clicking on an element containing the given text.
 *
 * VS Code webviews have a layered iframe architecture:
 *   Main page → vscode-webview:// outer frame → inner content iframe (our Svelte app)
 *
 * The outer frame is a CDP iframe target. The inner iframe is same-origin and
 * accessible via iframe.contentDocument from the outer frame.
 */
async function selectTaskInWebview(cdp: CdpClient, taskText: string): Promise<boolean> {
  console.log(`    Attempting task selection: "${taskText}"`);

  // Discover iframe targets
  try {
    await cdp.send('Target.setDiscoverTargets', { discover: true });
  } catch {
    /* ignore */
  }

  const { targetInfos } = (await cdp.send('Target.getTargets')) as {
    targetInfos: Array<{ targetId: string; type: string; url: string }>;
  };

  const iframeTargets = targetInfos.filter(
    (t) => t.type === 'iframe' && t.url?.includes('vscode-webview')
  );

  if (iframeTargets.length === 0) {
    console.log('    No webview iframe targets found');
    return false;
  }

  for (const target of iframeTargets) {
    let sessionId: string;
    try {
      const attached = (await cdp.send('Target.attachToTarget', {
        targetId: target.targetId,
        flatten: true,
      })) as { sessionId: string };
      sessionId = attached.sessionId;
    } catch {
      continue;
    }

    try {
      await cdp.sendToSession(sessionId, 'Runtime.enable');

      // Access the inner iframe's contentDocument (same-origin) and click the task.
      // We must create the MouseEvent using the inner frame's constructor so that
      // Svelte event handlers (attached in the inner frame's JS context) fire correctly.
      const clickResult = (await cdp.sendToSession(sessionId, 'Runtime.evaluate', {
        expression: `(() => {
          const iframe = document.querySelector('iframe');
          if (!iframe) return 'no-iframe';
          let doc, win;
          try {
            doc = iframe.contentDocument || iframe.contentWindow?.document;
            win = iframe.contentWindow;
          } catch(e) { return 'cross-origin'; }
          if (!doc || !win) return 'no-doc';

          // Check if this webview has task content
          if (!doc.body?.textContent?.includes('TASK-')) return 'no-tasks';

          // Try to find the task element using specific selectors
          // TaskCard.svelte: .task-card[data-task-id="TASK-X"]
          // ListView.svelte: tr[data-task-id="TASK-X"]
          const selectors = ['.task-card', 'tr[data-task-id]'];
          for (const sel of selectors) {
            for (const el of doc.querySelectorAll(sel)) {
              if (el.textContent?.includes(${JSON.stringify(taskText)})) {
                // Create the click event in the INNER frame's context
                const event = new win.MouseEvent('click', {
                  bubbles: true, cancelable: true, view: win
                });
                el.dispatchEvent(event);
                return 'clicked:' + sel + ':' + (el.getAttribute('data-task-id') || '');
              }
            }
          }
          return 'task-not-found:' + doc.body.textContent.substring(0, 80);
        })()`,
        returnByValue: true,
      })) as { result?: { value?: string } };

      const result = String(clickResult?.result?.value ?? '');

      try {
        await cdp.send('Target.detachFromTarget', { sessionId });
      } catch {
        /* ignore */
      }

      if (result.startsWith('clicked:')) {
        console.log(`    Selected task via ${result.split(':')[1]}`);
        return true;
      }

      // Continue to next target if this one didn't have the task
      if (result === 'no-tasks' || result === 'no-iframe') continue;
      if (result.startsWith('task-not-found:')) {
        console.log(`    Task not in this frame: ${result.substring(15, 80)}...`);
        continue;
      }
    } catch {
      try {
        await cdp.send('Target.detachFromTarget', { sessionId });
      } catch {
        /* ignore */
      }
    }
  }

  console.log(`    Task "${taskText}" not found in any webview`);
  return false;
}

/**
 * Click a button with the given text in any webview iframe.
 * Used to click the "Edit" button in the sidebar task preview.
 */
async function clickButtonInWebview(cdp: CdpClient, buttonText: string): Promise<boolean> {
  console.log(`    Clicking webview button: "${buttonText}"`);

  try {
    await cdp.send('Target.setDiscoverTargets', { discover: true });
  } catch {
    /* ignore */
  }

  const { targetInfos } = (await cdp.send('Target.getTargets')) as {
    targetInfos: Array<{ targetId: string; type: string; url: string }>;
  };

  const iframeTargets = targetInfos.filter(
    (t) => t.type === 'iframe' && t.url?.includes('vscode-webview')
  );

  for (const target of iframeTargets) {
    let sessionId: string;
    try {
      const attached = (await cdp.send('Target.attachToTarget', {
        targetId: target.targetId,
        flatten: true,
      })) as { sessionId: string };
      sessionId = attached.sessionId;
    } catch {
      continue;
    }

    try {
      await cdp.sendToSession(sessionId, 'Runtime.enable');

      const clickResult = (await cdp.sendToSession(sessionId, 'Runtime.evaluate', {
        expression: `(() => {
          const iframe = document.querySelector('iframe');
          if (!iframe) return 'no-iframe';
          let doc, win;
          try {
            doc = iframe.contentDocument || iframe.contentWindow?.document;
            win = iframe.contentWindow;
          } catch(e) { return 'cross-origin'; }
          if (!doc || !win) return 'no-doc';

          const buttons = [...doc.querySelectorAll('button, [role="button"]')];
          const btn = buttons.find(b => b.textContent?.trim() === ${JSON.stringify(buttonText)});
          if (!btn) return 'not-found';

          const event = new win.MouseEvent('click', {
            bubbles: true, cancelable: true, view: win
          });
          btn.dispatchEvent(event);
          return 'clicked';
        })()`,
        returnByValue: true,
      })) as { result?: { value?: string } };

      const result = String(clickResult?.result?.value ?? '');

      try {
        await cdp.send('Target.detachFromTarget', { sessionId });
      } catch {
        /* ignore */
      }

      if (result === 'clicked') {
        console.log(`    Clicked "${buttonText}" button`);
        return true;
      }
    } catch {
      try {
        await cdp.send('Target.detachFromTarget', { sessionId });
      } catch {
        /* ignore */
      }
    }
  }

  console.log(`    Button "${buttonText}" not found in any webview`);
  return false;
}

/**
 * Collapse the DETAILS panel in the sidebar by dragging the horizontal sash
 * to the bottom, giving the TASKS panel (kanban/list) the full sidebar height.
 */
async function collapseDetailsPanel(cdp: CdpClient): Promise<void> {
  console.log('    Collapsing DETAILS panel...');

  const sashInfo = (await cdpEval(
    cdp,
    `(() => {
      const sidebar = document.querySelector('.part.sidebar');
      if (!sidebar) return null;
      // Find the horizontal sash within the sidebar (divider between TASKS and DETAILS panels)
      const sash = sidebar.querySelector('.monaco-sash.horizontal');
      if (!sash) return null;
      const rect = sash.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        targetY: sidebarRect.bottom - 2
      };
    })()`
  )) as { x: number; y: number; targetY: number } | null;

  if (!sashInfo) {
    console.log('    Could not find horizontal sash in sidebar');
    return;
  }

  // Drag the sash to the bottom of the sidebar
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: sashInfo.x,
    y: sashInfo.y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(50);

  const steps = 3;
  for (let i = 1; i <= steps; i++) {
    const y = sashInfo.y + ((sashInfo.targetY - sashInfo.y) * i) / steps;
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: sashInfo.x,
      y,
      button: 'left',
    });
    await sleep(20);
  }

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: sashInfo.x,
    y: sashInfo.targetY,
    button: 'left',
    clickCount: 1,
  });

  await sleep(300);
  console.log('    DETAILS panel collapsed');
}

/**
 * Expand the DETAILS panel to roughly half the sidebar height.
 * Drags the horizontal sash between TASKS and DETAILS upward.
 */
async function expandDetailsPanel(cdp: CdpClient): Promise<void> {
  console.log('    Expanding DETAILS panel...');

  const sashInfo = (await cdpEval(
    cdp,
    `(() => {
      const sidebar = document.querySelector('.part.sidebar');
      if (!sidebar) return null;
      const sash = sidebar.querySelector('.monaco-sash.horizontal');
      if (!sash) return null;
      const rect = sash.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        targetY: sidebarRect.top + sidebarRect.height * 0.45
      };
    })()`
  )) as { x: number; y: number; targetY: number } | null;

  if (!sashInfo) {
    console.log('    Could not find horizontal sash in sidebar');
    return;
  }

  // Drag the sash upward to give DETAILS more room
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: sashInfo.x,
    y: sashInfo.y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(50);

  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const y = sashInfo.y + ((sashInfo.targetY - sashInfo.y) * i) / steps;
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: sashInfo.x,
      y,
      button: 'left',
    });
    await sleep(20);
  }

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: sashInfo.x,
    y: sashInfo.targetY,
    button: 'left',
    clickCount: 1,
  });

  await sleep(300);
  console.log('    DETAILS panel expanded');
}

// --- Command Palette ---

async function runCommand(cdp: CdpClient, commandLabel: string): Promise<void> {
  console.log(`    Running command: ${commandLabel}`);
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

/** Reset the editor state between scenarios */
async function resetEditorState(cdp: CdpClient): Promise<void> {
  // Close all open editors
  await cdpKeyPress(cdp, 'Escape');
  await sleep(200);
  // Use keyboard shortcut: Ctrl+K then Ctrl+W to close all editors
  const mod = process.platform === 'darwin' ? 4 : 2; // meta on mac, ctrl on linux
  // Ctrl+K
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
  // Ctrl+W
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

/** Open a file via Quick Open (Ctrl+P / Cmd+P) */
async function quickOpenFile(cdp: CdpClient, filename: string): Promise<void> {
  console.log(`    Quick-opening file: ${filename}`);
  // Use Ctrl+P (works on both macOS and Linux in VS Code)
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'p',
    code: 'KeyP',
    windowsVirtualKeyCode: 80,
    modifiers: process.platform === 'darwin' ? 4 : 2, // meta on mac, ctrl on linux
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'p',
    code: 'KeyP',
    modifiers: process.platform === 'darwin' ? 4 : 2,
  });
  await sleep(600);
  await cdpType(cdp, filename);
  await sleep(600);
  await cdpKeyPress(cdp, 'Enter');
  await sleep(1000);
}

// --- Scenario Execution ---

async function executeScenario(
  instance: VsCodeInstance,
  scenario: ScreenshotScenario,
  outputPath: string
): Promise<{ cropBounds?: { left: number; top: number; width: number; height: number } }> {
  const { cdp } = instance;
  console.log(`  Scenario: ${scenario.name} — ${scenario.description}`);

  // Reset editor state between scenarios
  await resetEditorState(cdp);

  // Set sidebar width
  const sidebarWidth = scenario.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
  await widenSidebar(cdp, sidebarWidth);

  for (const step of scenario.steps) {
    switch (step.type) {
      case 'command':
        await runCommand(cdp, step.command);
        break;
      case 'wait':
        await sleep(step.ms);
        break;
      case 'quickOpen':
        await quickOpenFile(cdp, step.filename);
        break;
      case 'selectTask':
        await selectTaskInWebview(cdp, step.text);
        break;
      case 'keyboard':
        await cdpKeyPress(cdp, step.key);
        break;
      case 'collapseDetails':
        await collapseDetailsPanel(cdp);
        break;
      case 'expandDetails':
        await expandDetailsPanel(cdp);
        break;
      case 'clickWebviewButton':
        await clickButtonInWebview(cdp, step.text);
        break;
    }
  }

  // Dismiss any notifications before capturing
  await dismissNotifications(cdp);
  // Also hide the status bar notification area if it has a blue notification dot
  await cdpEval(
    cdp,
    `document.querySelectorAll('.notifications-toasts, .notification-toast-container').forEach(el => el.style.display = 'none')`
  );

  // Wait for animations to settle
  await sleep(500);

  // Capture screenshot
  console.log(`  Capturing: ${path.basename(outputPath)}`);
  await cdpScreenshot(cdp, outputPath);

  // Query crop bounds while CDP is still connected
  let cropBounds: { left: number; top: number; width: number; height: number } | undefined;
  if (scenario.crop) {
    const bounds = await getCropBounds(cdp, scenario.crop);
    if (bounds) {
      console.log(
        `  Crop bounds (${scenario.crop}): ${bounds.width}x${bounds.height} at (${bounds.left},${bounds.top})`
      );
      cropBounds = bounds;
    } else {
      console.log(`  Warning: Could not find crop bounds for ${scenario.crop}`);
    }
  }

  return { cropBounds };
}

// --- Optimization ---

function findOxipng(): string | null {
  const binStub = path.join(PROJECT_ROOT, 'node_modules/.bin/oxipng');
  if (fs.existsSync(binStub)) return binStub;

  const platform =
    process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'win' : 'linux';
  const ext = process.platform === 'win32' ? '.exe' : '';
  const vendorBin = path.join(
    PROJECT_ROOT,
    `node_modules/oxipng-bin/vendor/${platform}/oxipng${ext}`
  );
  if (fs.existsSync(vendorBin)) {
    try {
      fs.chmodSync(vendorBin, 0o755);
    } catch {
      /* ignore */
    }
    return vendorBin;
  }

  return null;
}

function optimizePng(filePath: string): void {
  const oxipng = findOxipng();
  if (oxipng) {
    execSync(`"${oxipng}" -o 4 --strip safe "${filePath}"`, { stdio: 'pipe' });
    return;
  }
  console.log(`  Using sharp fallback for PNG optimization`);
}

async function optimizeWithSharp(filePath: string): Promise<void> {
  const { default: sharp } = await import('sharp');
  const buffer = await sharp(filePath).png({ compressionLevel: 9, effort: 10 }).toBuffer();
  fs.writeFileSync(filePath, buffer);
}

// --- Main ---

async function main(): Promise<void> {
  const opts = parseArgs();
  const startTime = Date.now();

  console.log('Screenshot Generation');
  console.log('====================');
  console.log(`Themes: ${opts.themes.join(', ')}`);
  console.log(`Scenarios: ${opts.scenarioFilter || 'all'}`);
  console.log(`Window chrome: ${opts.skipChrome ? 'skip' : 'add'}`);
  console.log(`Optimization: ${opts.skipOptimize ? 'skip' : 'oxipng'}`);
  console.log();

  // Filter scenarios
  const activeScenarios = opts.scenarioFilter
    ? scenarios.filter((s) => s.name === opts.scenarioFilter)
    : scenarios;

  if (activeScenarios.length === 0) {
    console.error(
      `No scenario matching "${opts.scenarioFilter}". Available: ${scenarios.map((s) => s.name).join(', ')}`
    );
    process.exit(1);
  }

  // Create output directories
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const theme of opts.themes) {
    fs.mkdirSync(path.join(OUTPUT_DIR, theme), { recursive: true });
  }

  let totalScreenshots = 0;

  for (const themeConfig of themes.filter((t) => opts.themes.includes(t.id))) {
    console.log(`\nTheme: ${themeConfig.name}`);
    console.log('-'.repeat(40));

    let instance: VsCodeInstance | null = null;

    try {
      instance = await launchVsCode(themeConfig.id, themeConfig.setting);

      await cdpSetViewport(instance.cdp);
      await waitForVsCodeReady(instance.cdp);
      await dismissNotifications(instance.cdp);

      // Remove sash focus outlines from screenshots
      await cdpEval(
        instance.cdp,
        `(() => {
          const style = document.createElement('style');
          style.textContent = '.monaco-sash:focus, .monaco-sash:focus-visible { outline: none !important; }';
          document.head.appendChild(style);
        })()`
      );

      // Close the secondary sidebar (chat/copilot) BEFORE theme switch.
      // runCommand starts with Escape which would revert a pending theme preview.
      try {
        await runCommand(instance.cdp, 'View: Close Secondary Side Bar');
        await sleep(300);
        await cdpKeyPress(instance.cdp, 'Escape');
        await sleep(200);
      } catch {
        // Ignore
      }
      // Force-hide via DOM as fallback
      await cdpEval(
        instance.cdp,
        `(() => {
          const aux = document.querySelector('.part.auxiliarybar');
          if (aux) aux.style.display = 'none';
          document.querySelectorAll('[id*="chat"], [class*="chat"]').forEach(el => {
            if (el.classList.contains('part')) el.style.display = 'none';
          });
        })()`
      );
      await sleep(200);

      // Switch theme if needed. This MUST be the last step before scenarios
      // because VS Code 1.109+ ignores settings.json colorTheme on first launch
      // (it forces the new 2026 dark theme). The command palette theme picker is
      // the only reliable way to change themes at runtime.
      // IMPORTANT: nothing should call runCommand (which starts with Escape) after
      // this point, as Escape can revert a theme picker preview.
      const wbClasses = String(
        (await cdpEval(
          instance.cdp,
          `[...document.querySelector('.monaco-workbench')?.classList || []].join(' ')`
        )) ?? ''
      ).split(' ');
      const isDark = wbClasses.includes('vs-dark');
      const isLight = wbClasses.includes('vs') && !isDark;
      const currentTheme = isLight ? 'light' : isDark ? 'dark' : 'unknown';
      console.log(`  Current theme: ${currentTheme}`);

      if (currentTheme !== themeConfig.id) {
        console.log(`  Switching to ${themeConfig.setting} via Ctrl+K Ctrl+T...`);
        // Use Ctrl+K Ctrl+T keyboard chord to open the theme picker directly.
        // This bypasses the command palette which can fuzzy-match to
        // "Browse Color Themes in Marketplace" instead of the theme picker.
        await cdpKeyPress(instance.cdp, 'Escape');
        await sleep(200);
        const mod = process.platform === 'darwin' ? 4 : 2; // meta on mac, ctrl on linux
        // Ctrl+K (first chord)
        await instance.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'k',
          code: 'KeyK',
          windowsVirtualKeyCode: 75,
          modifiers: mod,
        });
        await instance.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'k',
          code: 'KeyK',
          modifiers: mod,
        });
        await sleep(300);
        // Ctrl+T (second chord)
        await instance.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 't',
          code: 'KeyT',
          windowsVirtualKeyCode: 84,
          modifiers: mod,
        });
        await instance.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 't',
          code: 'KeyT',
          modifiers: mod,
        });
        await sleep(800);
        // Type the theme name to filter
        await cdpType(instance.cdp, themeConfig.setting, 40);
        await sleep(1000);

        // Press Enter to confirm the theme selection.
        // The theme picker can require multiple Enter presses: first to select the
        // filtered item, then to confirm. Press Enter and verify the picker closed.
        for (let attempt = 0; attempt < 3; attempt++) {
          await cdpKeyPress(instance.cdp, 'Enter');
          await sleep(800);
          // Check if the quick input is still visible
          const pickerOpen = await cdpEval(
            instance.cdp,
            `(() => {
              const qi = document.querySelector('.quick-input-widget');
              if (!qi) return false;
              const s = getComputedStyle(qi);
              return s.display !== 'none' && s.visibility !== 'hidden';
            })()`
          );
          if (!pickerOpen) {
            console.log(`  Theme picker closed after ${attempt + 1} Enter press(es)`);
            break;
          }
          if (attempt === 2) {
            console.log(`  Theme picker still open — forcing close with Escape`);
            // Last resort: Escape and accept the preview was applied via settings
          }
        }
        await sleep(1000);

        // Verify the switch stuck
        const newClasses = String(
          (await cdpEval(
            instance.cdp,
            `[...document.querySelector('.monaco-workbench')?.classList || []].join(' ')`
          )) ?? ''
        ).split(' ');
        const newTheme =
          newClasses.includes('vs') && !newClasses.includes('vs-dark')
            ? 'light'
            : newClasses.includes('vs-dark')
              ? 'dark'
              : 'unknown';
        console.log(`  Theme after switch: ${newTheme}`);
      }

      for (const scenario of activeScenarios) {
        const rawPath = path.join(RAW_DIR, `${themeConfig.id}-${scenario.name}.png`);
        const finalPath = path.join(OUTPUT_DIR, themeConfig.id, `${scenario.name}.png`);

        try {
          const result = await executeScenario(instance, scenario, rawPath);

          // Crop to panel if specified
          if (result.cropBounds) {
            console.log(`  Cropping to ${scenario.crop} panel...`);
            await cropImage(rawPath, result.cropBounds);
          }

          // Apply chrome framing
          if (!opts.skipChrome) {
            if (scenario.chrome === 'panel') {
              console.log(`  Adding panel frame...`);
              await addPanelFrame(rawPath, finalPath, themeConfig.id);
            } else {
              console.log(`  Adding window chrome...`);
              await addWindowChrome(rawPath, finalPath, themeConfig.id);
            }
          } else {
            fs.copyFileSync(rawPath, finalPath);
          }

          if (!opts.skipOptimize) {
            console.log(`  Optimizing PNG...`);
            try {
              optimizePng(finalPath);
            } catch {
              await optimizeWithSharp(finalPath);
            }
          }

          const stats = fs.statSync(finalPath);
          console.log(`  Done: ${finalPath} (${(stats.size / 1024).toFixed(0)} KB)`);
          totalScreenshots++;
        } catch (err) {
          console.error(`  ERROR in scenario "${scenario.name}":`, err);
        }
      }
    } finally {
      if (instance) {
        console.log(`  Closing VS Code...`);
        closeVsCode(instance);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Generated ${totalScreenshots} screenshots in ${elapsed}s`);
  console.log(`Output: ${OUTPUT_DIR}/`);

  if (totalScreenshots === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
