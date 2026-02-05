import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import type { WebviewMessage, Task } from '../core/types';

/**
 * Dashboard statistics data structure
 */
interface DashboardStats {
  totalTasks: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  milestones: { name: string; total: number; done: number }[];
}

/**
 * Provides a dashboard webview with project statistics
 *
 * This provider loads a compiled Svelte component (Dashboard.svelte) that handles
 * all UI rendering. The provider is responsible for:
 * - Loading the Svelte bundle and styles
 * - Computing statistics from tasks
 * - Sending stats to the webview via postMessage
 * - Handling filterByStatus messages from the webview
 */
export class DashboardViewProvider extends BaseViewProvider {
  protected get viewType(): string {
    return 'backlog.dashboard';
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const styleUri = this.getResourceUri(webview, 'styles.css');
    const scriptUri = this.getResourceUri(webview, 'dashboard.js');

    // CSP allows our script and ES module imports from the same origin
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>Dashboard</title>
</head>
<body class="dashboard-page">
    <div id="app"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Override refresh to compute and send statistics
   */
  async refresh(): Promise<void> {
    if (!this._view) return;

    if (!this.parser) {
      this.postMessage({ type: 'noBacklogFolder' });
      return;
    }

    try {
      const tasks = await this.parser.getTasks();
      const stats = this.computeStatistics(tasks);
      this._view.webview.postMessage({ type: 'statsUpdated', stats });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing Dashboard:', error);
      this.postMessage({ type: 'error', message: 'Failed to load statistics' });
    }
  }

  /**
   * Compute statistics from tasks
   */
  private computeStatistics(tasks: Task[]): DashboardStats {
    const byStatus: Record<string, number> = {
      'To Do': 0,
      'In Progress': 0,
      Done: 0,
    };

    const byPriority: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    const milestoneMap = new Map<string, { total: number; done: number }>();

    for (const task of tasks) {
      // Count by status
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;

      // Count by priority
      const priority = task.priority || 'none';
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      // Count by milestone
      if (task.milestone) {
        if (!milestoneMap.has(task.milestone)) {
          milestoneMap.set(task.milestone, { total: 0, done: 0 });
        }
        const m = milestoneMap.get(task.milestone)!;
        m.total++;
        if (task.status === 'Done') {
          m.done++;
        }
      }
    }

    // Convert milestone map to sorted array
    const milestones = Array.from(milestoneMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => {
        // Sort by completion percentage (lowest first, so incomplete milestones show up top)
        const aPct = a.total > 0 ? a.done / a.total : 0;
        const bPct = b.total > 0 ? b.done / b.total : 0;
        return aPct - bPct;
      });

    return {
      totalTasks: tasks.length,
      byStatus,
      byPriority,
      milestones,
    };
  }

  protected async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'refresh':
        await this.refresh();
        break;
      case 'filterByStatus':
        vscode.commands.executeCommand('backlog.filterByStatus', message.status);
        break;
    }
  }
}
