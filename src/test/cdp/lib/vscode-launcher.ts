/**
 * VS Code binary detection, launch, and CDP connection.
 *
 * Extracted and adapted from scripts/screenshots/generate.ts.
 */

import { spawn, execSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { CdpClient } from './CdpClient';
import { sleep } from './cdp-helpers';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

export interface VsCodeInstance {
  proc: ChildProcess;
  cdp: CdpClient;
  cdpPort: number;
}

export interface LaunchOptions {
  workspacePath: string;
  cdpPort?: number;
  userDataDir?: string;
  /** Extra CLI args passed to VS Code */
  extraArgs?: string[];
}

/** Find the VS Code / Code binary for the current platform */
export function findVsCodeBinary(): string {
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';

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

  throw new Error(
    `Could not find VS Code binary for ${process.platform}. ` +
      'Run "bun run test:e2e" first to download it.'
  );
}

/** Poll the CDP /json/list endpoint until a page target appears */
export async function waitForCdpReady(port: number, timeoutMs = 30_000): Promise<string> {
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
    await sleep(500);
  }
  throw new Error(`CDP not ready after ${timeoutMs}ms on port ${port}`);
}

/** Launch VS Code with CDP debugging and return a connected instance */
export async function launchVsCode(opts: LaunchOptions): Promise<VsCodeInstance> {
  const binary = findVsCodeBinary();
  const cdpPort = opts.cdpPort ?? 9340;
  const userDataDir =
    opts.userDataDir ?? path.join(PROJECT_ROOT, '.vscode-test/settings/cdp-tests');

  // Clean user-data-dir to eliminate cached state
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  // Write minimal settings and keybindings
  const userDir = path.join(userDataDir, 'User');
  fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDir, 'settings.json'),
    JSON.stringify(
      {
        'workbench.startupEditor': 'none',
        'extensions.autoUpdate': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'window.restoreWindows': 'none',
        'workbench.tips.enabled': false,
        'workbench.enableExperiments': false,
        'git.enabled': false,
        'chat.commandCenter.enabled': false,
        'chat.editor.enabled': false,
        'extensions.ignoreRecommendations': true,
      },
      null,
      2
    )
  );

  // Register keybindings for commands used in tests (avoids slow command palette typing)
  fs.writeFileSync(
    path.join(userDir, 'keybindings.json'),
    JSON.stringify(
      [
        { key: 'ctrl+shift+alt+k', command: 'backlog.openKanban' },
        { key: 'ctrl+shift+alt+r', command: 'backlog.refresh' },
        { key: 'ctrl+shift+alt+l', command: 'backlog.showListView' },
        { key: 'ctrl+shift+alt+b', command: 'backlog.showKanbanView' },
      ],
      null,
      2
    )
  );

  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  if (process.platform === 'linux') {
    env.ELECTRON_DISABLE_GPU = '1';
  }

  const args = [
    opts.workspacePath,
    '--extensionDevelopmentPath=' + PROJECT_ROOT,
    '--user-data-dir=' + userDataDir,
    '--disable-extensions',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--no-sandbox',
    `--remote-debugging-port=${cdpPort}`,
    ...(opts.extraArgs ?? []),
  ];

  const proc = spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.includes('DevTools listening')) {
      console.log(`  ${line.trim()}`);
    }
  });

  const pageWsUrl = await waitForCdpReady(cdpPort);
  const cdp = new CdpClient();
  await cdp.connect(pageWsUrl);

  return { proc, cdp, cdpPort };
}

/** Kill VS Code and close the CDP connection */
export function closeVsCode(instance: VsCodeInstance): void {
  instance.cdp.close();
  instance.proc.kill();
}
