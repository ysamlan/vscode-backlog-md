import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

/**
 * Result of CLI availability check
 */
export interface CliAvailabilityResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Handles detection and invocation of the Backlog.md CLI binary
 */
export class BacklogCli {
  private static cachedAvailability: CliAvailabilityResult | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Check if the backlog CLI is available on the system PATH
   * Results are cached for performance
   */
  static async isAvailable(): Promise<CliAvailabilityResult> {
    const now = Date.now();

    // Return cached result if still valid
    if (this.cachedAvailability && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedAvailability;
    }

    try {
      // Try to find the backlog binary
      const whichCommand = process.platform === 'win32' ? 'where backlog' : 'which backlog';
      const { stdout: pathOutput } = await execAsync(whichCommand);
      const cliPath = pathOutput.trim().split('\n')[0]; // Take first result on Windows

      // Try to get version
      let version: string | undefined;
      try {
        const { stdout: versionOutput } = await execAsync('backlog --version');
        version = versionOutput.trim();
      } catch {
        // Version check failed, but binary exists
      }

      this.cachedAvailability = {
        available: true,
        version,
        path: cliPath,
      };
    } catch {
      this.cachedAvailability = {
        available: false,
        error: 'backlog CLI not found on PATH',
      };
    }

    this.cacheTimestamp = now;
    return this.cachedAvailability;
  }

  /**
   * Clear the cached availability result
   */
  static clearCache(): void {
    this.cachedAvailability = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Show a warning notification when cross-branch features are configured
   * but CLI is not available
   */
  static showCrossbranchWarning(): void {
    const message =
      'Cross-branch task features require the backlog CLI. ' +
      'Showing local tasks only. Install backlog CLI or set checkActiveBranches: false in config.';

    vscode.window
      .showWarningMessage(message, 'Learn More', 'Dismiss')
      .then((selection) => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/MrLesk/Backlog.md'));
        }
      });
  }

  /**
   * Create a status bar item showing the current data source mode
   */
  static createStatusBarItem(): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.name = 'Backlog Data Source';
    return statusBarItem;
  }

  /**
   * Update the status bar item to show current data source mode
   */
  static updateStatusBarItem(
    statusBarItem: vscode.StatusBarItem,
    mode: 'local-only' | 'cross-branch' | 'hidden',
    reason?: string
  ): void {
    if (mode === 'hidden') {
      statusBarItem.hide();
      return;
    }

    if (mode === 'local-only') {
      statusBarItem.text = '$(database) Backlog: Local Only';
      statusBarItem.tooltip = reason || 'Viewing tasks from current branch only';
      statusBarItem.backgroundColor = undefined;
    } else {
      statusBarItem.text = '$(git-branch) Backlog: Cross-Branch';
      statusBarItem.tooltip = 'Viewing tasks across all branches';
      statusBarItem.backgroundColor = undefined;
    }

    statusBarItem.show();
  }

  /**
   * Execute a backlog CLI command and return the result
   * @param args Command arguments
   * @param cwd Working directory
   * @returns Command output or null if failed
   */
  static async execute(args: string[], cwd: string): Promise<string | null> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return null;
    }

    try {
      const command = `backlog ${args.join(' ')}`;
      const { stdout } = await execAsync(command, { cwd });
      return stdout;
    } catch (error) {
      console.error('[BacklogCli] Command execution failed:', error);
      return null;
    }
  }
}
