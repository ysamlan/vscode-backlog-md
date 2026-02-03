import * as vscode from 'vscode';
import { BacklogParser } from '../core/BacklogParser';
import { Task } from '../core/types';

/**
 * Provides a webview panel for displaying task details
 */
export class TaskDetailProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly parser: BacklogParser | undefined
  ) {}

  /**
   * Open or update the task detail panel for a specific task
   */
  async openTask(taskId: string): Promise<void> {
    if (!this.parser) {
      vscode.window.showErrorMessage('No backlog folder found');
      return;
    }

    const task = await this.parser.getTask(taskId);
    if (!task) {
      vscode.window.showErrorMessage(`Task ${taskId} not found`);
      return;
    }

    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it and update content
    if (TaskDetailProvider.currentPanel) {
      TaskDetailProvider.currentPanel.reveal(column);
      TaskDetailProvider.currentPanel.title = `${task.id}: ${task.title}`;
      TaskDetailProvider.currentPanel.webview.html = this.getHtmlContent(
        TaskDetailProvider.currentPanel.webview,
        task
      );
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'backlog.taskDetail',
      `${task.id}: ${task.title}`,
      column,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true,
      }
    );

    TaskDetailProvider.currentPanel = panel;
    panel.webview.html = this.getHtmlContent(panel.webview, task);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'openFile':
          if (task.filePath) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(task.filePath));
          }
          break;
        case 'openTask':
          await this.openTask(message.taskId);
          break;
      }
    });

    // Reset when the panel is closed
    panel.onDidDispose(() => {
      TaskDetailProvider.currentPanel = undefined;
    });
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Get URI for a resource file
   */
  private getResourceUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', ...pathSegments)
    );
  }

  private getHtmlContent(webview: vscode.Webview, task: Task): string {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    const priorityClass = task.priority ? `priority-${task.priority}` : '';
    const statusClass = task.status.toLowerCase().replace(' ', '-');

    const labelsHtml =
      task.labels.length > 0
        ? task.labels.map((l) => `<span class="label">${this.escapeHtml(l)}</span>`).join('')
        : '<span class="empty-value">None</span>';

    const assigneesHtml =
      task.assignee.length > 0
        ? task.assignee.map((a) => `<span class="assignee">${this.escapeHtml(a)}</span>`).join('')
        : '<span class="empty-value">Unassigned</span>';

    const dependenciesHtml =
      task.dependencies.length > 0
        ? task.dependencies
            .map(
              (d) =>
                `<a href="#" class="dependency-link" data-task-id="${this.escapeHtml(d)}">${this.escapeHtml(d)}</a>`
            )
            .join(', ')
        : '<span class="empty-value">None</span>';

    const milestoneHtml = task.milestone
      ? `<span class="milestone">${this.escapeHtml(task.milestone)}</span>`
      : '<span class="empty-value">None</span>';

    const descriptionHtml = task.description
      ? `<div class="description-content">${this.escapeHtml(task.description)}</div>`
      : '<span class="empty-value">No description</span>';

    const acceptanceCriteriaHtml =
      task.acceptanceCriteria.length > 0
        ? `<ul class="checklist">${task.acceptanceCriteria
            .map(
              (item) =>
                `<li class="${item.checked ? 'checked' : ''}">
              <span class="checkbox">${item.checked ? '☑' : '☐'}</span>
              ${this.escapeHtml(item.text)}
            </li>`
            )
            .join('')}</ul>`
        : '<span class="empty-value">None defined</span>';

    const definitionOfDoneHtml =
      task.definitionOfDone.length > 0
        ? `<ul class="checklist">${task.definitionOfDone
            .map(
              (item) =>
                `<li class="${item.checked ? 'checked' : ''}">
              <span class="checkbox">${item.checked ? '☑' : '☐'}</span>
              ${this.escapeHtml(item.text)}
            </li>`
            )
            .join('')}</ul>`
        : '<span class="empty-value">None defined</span>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>${this.escapeHtml(task.title)}</title>
    <style>
        body {
            padding: 20px;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.5;
        }
        .task-header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .task-id {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        .task-title {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 12px 0;
        }
        .task-badges {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-to-do {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .status-in-progress {
            background: #3b82f620;
            color: #3b82f6;
        }
        .status-done {
            background: #10b98120;
            color: #10b981;
        }
        .status-draft {
            background: #6b728020;
            color: #6b7280;
        }
        .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .priority-high {
            background: #dc262620;
            color: #dc2626;
        }
        .priority-medium {
            background: #f59e0b20;
            color: #f59e0b;
        }
        .priority-low {
            background: #10b98120;
            color: #10b981;
        }
        .section {
            margin-bottom: 24px;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }
        .meta-item {
            background: var(--vscode-sideBar-background);
            padding: 12px;
            border-radius: 6px;
        }
        .meta-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .label, .assignee, .milestone {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            margin-right: 4px;
        }
        .dependency-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .dependency-link:hover {
            text-decoration: underline;
        }
        .empty-value {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .description-content {
            background: var(--vscode-sideBar-background);
            padding: 16px;
            border-radius: 6px;
            white-space: pre-wrap;
        }
        .checklist {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .checklist li {
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            align-items: flex-start;
            gap: 8px;
        }
        .checklist li:last-child {
            border-bottom: none;
        }
        .checklist li.checked {
            color: var(--vscode-descriptionForeground);
            text-decoration: line-through;
        }
        .checkbox {
            font-size: 16px;
        }
        .open-file-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .open-file-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .actions {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-widget-border);
        }
    </style>
</head>
<body>
    <div class="task-header">
        <div class="task-id">${this.escapeHtml(task.id)}</div>
        <h1 class="task-title">${this.escapeHtml(task.title)}</h1>
        <div class="task-badges">
            <span class="status-badge status-${statusClass}">${this.escapeHtml(task.status)}</span>
            ${task.priority ? `<span class="priority-badge ${priorityClass}">${this.escapeHtml(task.priority)}</span>` : ''}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Details</div>
        <div class="meta-grid">
            <div class="meta-item">
                <div class="meta-label">Labels</div>
                <div>${labelsHtml}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Assignees</div>
                <div>${assigneesHtml}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Milestone</div>
                <div>${milestoneHtml}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Dependencies</div>
                <div>${dependenciesHtml}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Description</div>
        ${descriptionHtml}
    </div>

    <div class="section">
        <div class="section-title">Acceptance Criteria</div>
        ${acceptanceCriteriaHtml}
    </div>

    <div class="section">
        <div class="section-title">Definition of Done</div>
        ${definitionOfDoneHtml}
    </div>

    <div class="actions">
        <button class="open-file-btn" id="openFileBtn">
            📄 Open Raw Markdown
        </button>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        document.getElementById('openFileBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'openFile' });
        });

        document.querySelectorAll('.dependency-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const taskId = link.dataset.taskId;
                vscode.postMessage({ type: 'openTask', taskId });
            });
        });
    </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
