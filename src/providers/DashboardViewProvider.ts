import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { WebviewMessage, Task } from '../core/types';

/**
 * Provides a dashboard webview with project statistics
 */
export class DashboardViewProvider extends BaseViewProvider {
  protected get viewType(): string {
    return 'backlog.dashboard';
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Dashboard</title>
</head>
<body class="dashboard-page">
    <div id="dashboard-content">
        <div class="empty-state">Loading statistics...</div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function renderDashboard(stats) {
            const container = document.getElementById('dashboard-content');

            if (stats.totalTasks === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div style="font-size: 48px; margin-bottom: 16px;">&#128202;</div>
                        <h3>No Tasks Yet</h3>
                        <p>Create tasks in your backlog/ folder to see statistics.</p>
                    </div>
                \`;
                return;
            }

            const completionPct = stats.totalTasks > 0
                ? Math.round((stats.byStatus.Done / stats.totalTasks) * 100)
                : 0;

            container.innerHTML = \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${stats.totalTasks}</div>
                        <div class="stat-label">Total Tasks</div>
                    </div>
                    <div class="stat-card stat-in-progress">
                        <div class="stat-value">\${stats.byStatus['In Progress'] || 0}</div>
                        <div class="stat-label">In Progress</div>
                    </div>
                    <div class="stat-card stat-done">
                        <div class="stat-value">\${completionPct}%</div>
                        <div class="stat-label">Completed</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Status Breakdown</div>
                    <div class="status-breakdown">
                        \${Object.entries(stats.byStatus).map(([status, count]) => {
                            const pct = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
                            const statusClass = status.toLowerCase().replace(/\\s+/g, '-');
                            return \`
                                <div class="status-row">
                                    <span class="status-name">\${escapeHtml(status)}</span>
                                    <div class="status-bar-container">
                                        <div class="status-bar status-bar-\${statusClass}" style="width: \${pct}%"></div>
                                    </div>
                                    <span class="status-count">\${count}</span>
                                </div>
                            \`;
                        }).join('')}
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Priority Distribution</div>
                    <div class="priority-breakdown">
                        <div class="priority-item priority-high">
                            <span class="priority-label">High</span>
                            <span class="priority-count">\${stats.byPriority.high || 0}</span>
                        </div>
                        <div class="priority-item priority-medium">
                            <span class="priority-label">Medium</span>
                            <span class="priority-count">\${stats.byPriority.medium || 0}</span>
                        </div>
                        <div class="priority-item priority-low">
                            <span class="priority-label">Low</span>
                            <span class="priority-count">\${stats.byPriority.low || 0}</span>
                        </div>
                        <div class="priority-item priority-none">
                            <span class="priority-label">None</span>
                            <span class="priority-count">\${stats.byPriority.none || 0}</span>
                        </div>
                    </div>
                </div>

                \${stats.milestones.length > 0 ? \`
                    <div class="section">
                        <div class="section-title">Milestone Progress</div>
                        <div class="milestone-list">
                            \${stats.milestones.map(m => {
                                const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                                return \`
                                    <div class="milestone-item">
                                        <div class="milestone-info">
                                            <span class="milestone-name">\${escapeHtml(m.name)}</span>
                                            <span class="milestone-stats">\${m.done}/\${m.total} tasks</span>
                                        </div>
                                        <div class="milestone-bar-container">
                                            <div class="milestone-bar" style="width: \${pct}%"></div>
                                        </div>
                                        <span class="milestone-pct">\${pct}%</span>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                    </div>
                \` : ''}
            \`;
        }

        function renderNoBacklogState() {
            const container = document.getElementById('dashboard-content');
            container.innerHTML = \`
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 16px;">&#128203;</div>
                    <h3>No Backlog Found</h3>
                    <p>This workspace doesn't have a <code>backlog/</code> folder.</p>
                </div>
            \`;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'statsUpdated':
                    renderDashboard(message.stats);
                    break;
                case 'noBacklogFolder':
                    renderNoBacklogState();
                    break;
                case 'error':
                    console.error(message.message);
                    break;
            }
        });

        // Request initial data
        vscode.postMessage({ type: 'refresh' });
    </script>
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
    }
  }
}

interface DashboardStats {
  totalTasks: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  milestones: { name: string; total: number; done: number }[];
}
