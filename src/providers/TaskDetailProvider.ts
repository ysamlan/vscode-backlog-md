import * as vscode from 'vscode';
import { BacklogParser } from '../core/BacklogParser';
import { BacklogWriter } from '../core/BacklogWriter';
import { Task } from '../core/types';

/**
 * Provides a webview panel for displaying task details
 */
export class TaskDetailProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentTaskId: string | undefined;
  private readonly writer = new BacklogWriter();

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

    const statuses = await this.parser.getStatuses();
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it and update content
    if (TaskDetailProvider.currentPanel) {
      TaskDetailProvider.currentPanel.reveal(column);
      TaskDetailProvider.currentPanel.title = `${task.id}: ${task.title}`;
      TaskDetailProvider.currentTaskId = taskId;
      TaskDetailProvider.currentPanel.webview.html = this.getHtmlContent(
        TaskDetailProvider.currentPanel.webview,
        task,
        statuses
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
    TaskDetailProvider.currentTaskId = taskId;
    panel.webview.html = this.getHtmlContent(panel.webview, task, statuses);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    // Reset when the panel is closed
    panel.onDidDispose(() => {
      TaskDetailProvider.currentPanel = undefined;
      TaskDetailProvider.currentTaskId = undefined;
    });
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: {
    type: string;
    taskId?: string;
    listType?: 'acceptanceCriteria' | 'definitionOfDone';
    itemId?: number;
    field?: string;
    value?: string | string[];
  }): Promise<void> {
    switch (message.type) {
      case 'openFile':
        if (TaskDetailProvider.currentTaskId && this.parser) {
          const task = await this.parser.getTask(TaskDetailProvider.currentTaskId);
          if (task?.filePath) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(task.filePath));
          }
        }
        break;

      case 'openTask':
        if (message.taskId) {
          await this.openTask(message.taskId);
        }
        break;

      case 'toggleChecklistItem':
        if (
          TaskDetailProvider.currentTaskId &&
          this.parser &&
          message.listType &&
          message.itemId !== undefined
        ) {
          try {
            await this.writer.toggleChecklistItem(
              TaskDetailProvider.currentTaskId,
              message.listType,
              message.itemId,
              this.parser
            );
            // Refresh the view
            await this.openTask(TaskDetailProvider.currentTaskId);
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle checklist item: ${error}`);
          }
        }
        break;

      case 'updateField':
        if (TaskDetailProvider.currentTaskId && this.parser && message.field) {
          try {
            const updates: Record<string, unknown> = {};
            updates[message.field] = message.value;
            await this.writer.updateTask(
              TaskDetailProvider.currentTaskId,
              updates,
              this.parser
            );
            // Refresh the view
            await this.openTask(TaskDetailProvider.currentTaskId);
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to update task: ${error}`);
          }
        }
        break;
    }
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

  private getHtmlContent(webview: vscode.Webview, task: Task, statuses: string[]): string {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    const priorityClass = task.priority ? `priority-${task.priority}` : '';
    const statusClass = task.status.toLowerCase().replace(/\s+/g, '-');
    const priorities = ['high', 'medium', 'low'];

    // Generate status options
    const statusOptionsHtml = statuses
      .map(
        (s) =>
          `<option value="${this.escapeHtml(s)}" ${s === task.status ? 'selected' : ''}>${this.escapeHtml(s)}</option>`
      )
      .join('');

    // Generate priority options
    const priorityOptionsHtml = priorities
      .map(
        (p) =>
          `<option value="${p}" ${p === task.priority ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`
      )
      .join('');

    // Labels with remove buttons
    const labelsHtml =
      task.labels.length > 0
        ? task.labels
            .map(
              (l) =>
                `<span class="label editable-label" data-label="${this.escapeHtml(l)}">${this.escapeHtml(l)} <span class="remove-label">×</span></span>`
            )
            .join('')
        : '';
    const labelsJson = JSON.stringify(task.labels);

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

    const descriptionValue = task.description || '';

    const acChecked = task.acceptanceCriteria.filter((i) => i.checked).length;
    const acTotal = task.acceptanceCriteria.length;
    const acProgress = acTotal > 0 ? `${acChecked} of ${acTotal} complete` : '';

    const acceptanceCriteriaHtml =
      task.acceptanceCriteria.length > 0
        ? `<ul class="checklist">${task.acceptanceCriteria
            .map(
              (item) =>
                `<li class="checklist-item ${item.checked ? 'checked' : ''}" data-list-type="acceptanceCriteria" data-item-id="${item.id}">
              <span class="checkbox">${item.checked ? '☑' : '☐'}</span>
              <span class="checklist-text">${this.escapeHtml(item.text)}</span>
            </li>`
            )
            .join('')}</ul>`
        : '<span class="empty-value">None defined</span>';

    const dodChecked = task.definitionOfDone.filter((i) => i.checked).length;
    const dodTotal = task.definitionOfDone.length;
    const dodProgress = dodTotal > 0 ? `${dodChecked} of ${dodTotal} complete` : '';

    const definitionOfDoneHtml =
      task.definitionOfDone.length > 0
        ? `<ul class="checklist">${task.definitionOfDone
            .map(
              (item) =>
                `<li class="checklist-item ${item.checked ? 'checked' : ''}" data-list-type="definitionOfDone" data-item-id="${item.id}">
              <span class="checkbox">${item.checked ? '☑' : '☐'}</span>
              <span class="checklist-text">${this.escapeHtml(item.text)}</span>
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
        .checklist-item {
            cursor: pointer;
            transition: background 0.15s;
        }
        .checklist-item:hover {
            background: var(--vscode-list-hoverBackground);
            margin: 0 -8px;
            padding-left: 8px;
            padding-right: 8px;
        }
        .checklist-item.checked {
            color: var(--vscode-descriptionForeground);
        }
        .checklist-item.checked .checklist-text {
            text-decoration: line-through;
        }
        .checkbox {
            font-size: 16px;
            flex-shrink: 0;
        }
        .checklist-text {
            flex: 1;
        }
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .progress-indicator {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
        }
        .progress-indicator.complete {
            color: #10b981;
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
        /* Editable elements */
        .editable-title {
            font-size: 24px;
            font-weight: 600;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            color: inherit;
            width: 100%;
            padding: 4px 8px;
            margin: -4px -8px 8px -8px;
            font-family: inherit;
        }
        .editable-title:hover {
            border-color: var(--vscode-input-border);
        }
        .editable-title:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-input-background);
        }
        .dropdown-select {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid transparent;
            cursor: pointer;
            font-family: inherit;
        }
        .dropdown-select:hover {
            border-color: var(--vscode-input-border);
        }
        .dropdown-select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .status-select {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .status-select.status-in-progress {
            background: #3b82f620;
            color: #3b82f6;
        }
        .status-select.status-done {
            background: #10b98120;
            color: #10b981;
        }
        .status-select.status-draft {
            background: #6b728020;
            color: #6b7280;
        }
        .priority-select {
            text-transform: uppercase;
        }
        .priority-select.priority-high {
            background: #dc262620;
            color: #dc2626;
        }
        .priority-select.priority-medium {
            background: #f59e0b20;
            color: #f59e0b;
        }
        .priority-select.priority-low {
            background: #10b98120;
            color: #10b981;
        }
        .description-textarea {
            width: 100%;
            min-height: 120px;
            padding: 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.5;
            resize: vertical;
        }
        .description-textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .labels-container {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        .editable-label {
            cursor: default;
        }
        .remove-label {
            cursor: pointer;
            margin-left: 4px;
            opacity: 0.6;
        }
        .remove-label:hover {
            opacity: 1;
        }
        .add-label-input {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            border: 1px dashed var(--vscode-input-border);
            background: transparent;
            color: inherit;
            width: 80px;
        }
        .add-label-input:focus {
            outline: none;
            border-style: solid;
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-input-background);
        }
        .add-label-input::placeholder {
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="task-header">
        <div class="task-id">${this.escapeHtml(task.id)}</div>
        <input type="text" class="editable-title" id="titleInput" value="${this.escapeHtml(task.title)}" />
        <div class="task-badges">
            <select class="dropdown-select status-select status-${statusClass}" id="statusSelect">
                ${statusOptionsHtml}
            </select>
            <select class="dropdown-select priority-select ${priorityClass}" id="prioritySelect">
                <option value="">No Priority</option>
                ${priorityOptionsHtml}
            </select>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Details</div>
        <div class="meta-grid">
            <div class="meta-item">
                <div class="meta-label">Labels</div>
                <div class="labels-container" id="labelsContainer" data-labels='${labelsJson}'>
                    ${labelsHtml}
                    <input type="text" class="add-label-input" id="addLabelInput" placeholder="+ Add" />
                </div>
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
        <textarea class="description-textarea" id="descriptionTextarea" placeholder="Add a description...">${this.escapeHtml(descriptionValue)}</textarea>
    </div>

    <div class="section">
        <div class="section-header">
            <div class="section-title">Acceptance Criteria</div>
            ${acProgress ? `<span class="progress-indicator ${acChecked === acTotal ? 'complete' : ''}">${acProgress}</span>` : ''}
        </div>
        ${acceptanceCriteriaHtml}
    </div>

    <div class="section">
        <div class="section-header">
            <div class="section-title">Definition of Done</div>
            ${dodProgress ? `<span class="progress-indicator ${dodChecked === dodTotal ? 'complete' : ''}">${dodProgress}</span>` : ''}
        </div>
        ${definitionOfDoneHtml}
    </div>

    <div class="actions">
        <button class="open-file-btn" id="openFileBtn">
            📄 Open Raw Markdown
        </button>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Open raw markdown file
        document.getElementById('openFileBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'openFile' });
        });

        // Navigate to dependency task
        document.querySelectorAll('.dependency-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const taskId = link.dataset.taskId;
                vscode.postMessage({ type: 'openTask', taskId });
            });
        });

        // Toggle checklist items
        document.querySelectorAll('.checklist-item').forEach(item => {
            item.addEventListener('click', () => {
                const listType = item.dataset.listType;
                const itemId = parseInt(item.dataset.itemId, 10);
                vscode.postMessage({
                    type: 'toggleChecklistItem',
                    listType,
                    itemId
                });
            });
        });

        // Edit title
        const titleInput = document.getElementById('titleInput');
        let originalTitle = titleInput.value;
        titleInput.addEventListener('blur', () => {
            const newTitle = titleInput.value.trim();
            if (newTitle && newTitle !== originalTitle) {
                originalTitle = newTitle;
                vscode.postMessage({ type: 'updateField', field: 'title', value: newTitle });
            }
        });
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
            } else if (e.key === 'Escape') {
                titleInput.value = originalTitle;
                titleInput.blur();
            }
        });

        // Status dropdown
        const statusSelect = document.getElementById('statusSelect');
        statusSelect.addEventListener('change', () => {
            vscode.postMessage({ type: 'updateField', field: 'status', value: statusSelect.value });
        });

        // Priority dropdown
        const prioritySelect = document.getElementById('prioritySelect');
        prioritySelect.addEventListener('change', () => {
            const value = prioritySelect.value || undefined;
            vscode.postMessage({ type: 'updateField', field: 'priority', value });
        });

        // Description textarea
        const descriptionTextarea = document.getElementById('descriptionTextarea');
        let descriptionTimeout;
        descriptionTextarea.addEventListener('input', () => {
            clearTimeout(descriptionTimeout);
            descriptionTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'updateField', field: 'description', value: descriptionTextarea.value });
            }, 1000); // Debounce: save after 1s of no typing
        });
        descriptionTextarea.addEventListener('blur', () => {
            clearTimeout(descriptionTimeout);
            vscode.postMessage({ type: 'updateField', field: 'description', value: descriptionTextarea.value });
        });

        // Labels management
        const labelsContainer = document.getElementById('labelsContainer');
        const addLabelInput = document.getElementById('addLabelInput');
        let currentLabels = JSON.parse(labelsContainer.dataset.labels || '[]');

        // Remove label
        document.querySelectorAll('.remove-label').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const labelSpan = btn.parentElement;
                const labelToRemove = labelSpan.dataset.label;
                currentLabels = currentLabels.filter(l => l !== labelToRemove);
                vscode.postMessage({ type: 'updateField', field: 'labels', value: currentLabels });
            });
        });

        // Add label
        addLabelInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const newLabel = addLabelInput.value.trim();
                if (newLabel && !currentLabels.includes(newLabel)) {
                    currentLabels.push(newLabel);
                    vscode.postMessage({ type: 'updateField', field: 'labels', value: currentLabels });
                }
                addLabelInput.value = '';
            } else if (e.key === 'Escape') {
                addLabelInput.value = '';
                addLabelInput.blur();
            }
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
