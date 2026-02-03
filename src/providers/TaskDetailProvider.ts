import * as vscode from 'vscode';
import * as fs from 'fs';
import { BacklogParser } from '../core/BacklogParser';
import { BacklogWriter, computeContentHash, FileConflictError } from '../core/BacklogWriter';
import { Task } from '../core/types';

// Dynamic import for marked (ESM module)
let markedParse: ((markdown: string) => string | Promise<string>) | null = null;
async function parseMarkdown(markdown: string): Promise<string> {
  if (!markedParse) {
    const { marked } = await import('marked');
    marked.setOptions({ gfm: true, breaks: true });
    markedParse = marked.parse;
  }
  const result = markedParse(markdown);
  return typeof result === 'string' ? result : await result;
}

/**
 * Provides a webview panel for displaying task details
 */
export class TaskDetailProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentTaskId: string | undefined;
  private static currentFileHash: string | undefined;
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

    // Capture file state for conflict detection
    if (task.filePath && fs.existsSync(task.filePath)) {
      const fileContent = fs.readFileSync(task.filePath, 'utf-8');
      TaskDetailProvider.currentFileHash = computeContentHash(fileContent);
    } else {
      TaskDetailProvider.currentFileHash = undefined;
    }

    const statuses = await this.parser.getStatuses();
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it and update content
    if (TaskDetailProvider.currentPanel) {
      TaskDetailProvider.currentPanel.reveal(column);
      TaskDetailProvider.currentPanel.title = `${task.id}: ${task.title}`;
      TaskDetailProvider.currentTaskId = taskId;
      TaskDetailProvider.currentPanel.webview.html = await this.getHtmlContent(
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
    panel.webview.html = await this.getHtmlContent(panel.webview, task, statuses);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    // Reset when the panel is closed
    panel.onDidDispose(() => {
      TaskDetailProvider.currentPanel = undefined;
      TaskDetailProvider.currentTaskId = undefined;
      TaskDetailProvider.currentFileHash = undefined;
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
          // Check if file still exists before attempting update
          const task = await this.parser.getTask(TaskDetailProvider.currentTaskId);
          if (!task?.filePath || !fs.existsSync(task.filePath)) {
            const choice = await vscode.window.showErrorMessage(
              'The task file has been deleted or moved.',
              'Close Panel'
            );
            if (choice === 'Close Panel') {
              TaskDetailProvider.currentPanel?.dispose();
            }
            return;
          }

          try {
            const updates: Record<string, unknown> = {};
            updates[message.field] = message.value;
            await this.writer.updateTask(
              TaskDetailProvider.currentTaskId,
              updates,
              this.parser,
              TaskDetailProvider.currentFileHash
            );
            // Update stored hash after successful write
            const newContent = fs.readFileSync(task.filePath, 'utf-8');
            TaskDetailProvider.currentFileHash = computeContentHash(newContent);
            // Refresh the view
            await this.openTask(TaskDetailProvider.currentTaskId);
          } catch (error) {
            if (error instanceof FileConflictError) {
              await this.handleConflict(message.field, message.value);
            } else {
              vscode.window.showErrorMessage(`Failed to update task: ${error}`);
            }
          }
        }
        break;

      case 'archiveTask': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        const archiveTask = await this.parser.getTask(TaskDetailProvider.currentTaskId);
        if (!archiveTask) break;

        const confirmation = await vscode.window.showWarningMessage(
          `Archive task "${archiveTask.title}"? It will be moved to backlog/archive/tasks/`,
          { modal: true },
          'Archive'
        );

        if (confirmation === 'Archive') {
          try {
            await this.writer.archiveTask(TaskDetailProvider.currentTaskId, this.parser);
            vscode.window.showInformationMessage(`Task ${TaskDetailProvider.currentTaskId} archived`);
            TaskDetailProvider.currentPanel?.dispose();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive task: ${error}`);
          }
        }
        break;
      }
    }
  }

  /**
   * Handle file conflict when saving changes
   */
  private async handleConflict(field: string, value: unknown): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'This file has been modified externally since you opened it.',
      { modal: true },
      'Reload from Disk',
      'Overwrite Anyway',
      'View Diff'
    );

    const taskId = TaskDetailProvider.currentTaskId;
    if (!taskId || !this.parser) return;

    const task = await this.parser.getTask(taskId);

    switch (choice) {
      case 'Reload from Disk':
        // Re-open task with fresh content (discards pending changes)
        await this.openTask(taskId);
        break;

      case 'Overwrite Anyway': {
        // Force write by passing no expectedHash
        try {
          const updates: Record<string, unknown> = {};
          updates[field] = value;
          await this.writer.updateTask(taskId, updates, this.parser);
          // Update hash after successful write
          if (task?.filePath && fs.existsSync(task.filePath)) {
            const newContent = fs.readFileSync(task.filePath, 'utf-8');
            TaskDetailProvider.currentFileHash = computeContentHash(newContent);
          }
          await this.openTask(taskId);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to overwrite task: ${error}`);
        }
        break;
      }

      case 'View Diff':
        // Open the file in VS Code's editor so user can see current state
        if (task?.filePath) {
          await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(task.filePath));
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

  private async getHtmlContent(
    webview: vscode.Webview,
    task: Task,
    statuses: string[]
  ): Promise<string> {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    // Fetch unique labels and assignees for autocomplete
    const [uniqueLabels, uniqueAssignees] = await Promise.all([
      this.parser!.getUniqueLabels(),
      this.parser!.getUniqueAssignees(),
    ]);

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

    // Assignees with remove buttons (editable like labels)
    const assigneesHtml =
      task.assignee.length > 0
        ? task.assignee
            .map(
              (a) =>
                `<span class="assignee editable-assignee" data-assignee="${this.escapeHtml(a)}">${this.escapeHtml(a)} <span class="remove-assignee">×</span></span>`
            )
            .join('')
        : '';
    const assigneesJson = JSON.stringify(task.assignee);

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
    const descriptionHtml = descriptionValue
      ? await parseMarkdown(descriptionValue)
      : '<em class="empty-value">No description</em>';

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
        .open-file-btn, .archive-btn {
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
        .archive-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
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
        .assignees-container {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        .editable-assignee {
            cursor: default;
        }
        .remove-assignee {
            cursor: pointer;
            margin-left: 4px;
            opacity: 0.6;
        }
        .remove-assignee:hover {
            opacity: 1;
        }
        .add-assignee-input {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            border: 1px dashed var(--vscode-input-border);
            background: transparent;
            color: inherit;
            width: 80px;
        }
        .add-assignee-input:focus {
            outline: none;
            border-style: solid;
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-input-background);
        }
        .add-assignee-input::placeholder {
            color: var(--vscode-descriptionForeground);
        }
        /* Markdown content styles */
        .markdown-content {
            background: var(--vscode-sideBar-background);
            padding: 16px;
            border-radius: 6px;
            line-height: 1.6;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3,
        .markdown-content h4, .markdown-content h5, .markdown-content h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            font-weight: 600;
        }
        .markdown-content h1 { font-size: 1.5em; }
        .markdown-content h2 { font-size: 1.3em; }
        .markdown-content h3 { font-size: 1.1em; }
        .markdown-content p {
            margin: 0.5em 0;
        }
        .markdown-content ul, .markdown-content ol {
            margin: 0.5em 0;
            padding-left: 2em;
        }
        .markdown-content li {
            margin: 0.25em 0;
        }
        .markdown-content code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.9em;
        }
        .markdown-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 0.5em 0;
        }
        .markdown-content pre code {
            background: none;
            padding: 0;
        }
        .markdown-content a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .markdown-content a:hover {
            text-decoration: underline;
        }
        .markdown-content blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            margin: 0.5em 0;
            padding-left: 1em;
            color: var(--vscode-textBlockQuote-foreground);
        }
        .markdown-content table {
            border-collapse: collapse;
            margin: 0.5em 0;
        }
        .markdown-content th, .markdown-content td {
            border: 1px solid var(--vscode-widget-border);
            padding: 6px 12px;
        }
        .markdown-content th {
            background: var(--vscode-editor-background);
            font-weight: 600;
        }
        .description-container {
            position: relative;
        }
        .description-view {
            cursor: pointer;
        }
        .description-view:hover {
            outline: 1px dashed var(--vscode-input-border);
            outline-offset: 4px;
        }
        .description-edit-hint {
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            opacity: 0;
            transition: opacity 0.15s;
        }
        .description-view:hover + .description-edit-hint,
        .description-edit-hint:hover {
            opacity: 1;
        }
        .hidden {
            display: none !important;
        }
        .edit-btn {
            background: none;
            border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 12px;
            padding: 4px 8px;
        }
        .edit-btn:hover {
            text-decoration: underline;
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
                    <input type="text" class="add-label-input" id="addLabelInput" placeholder="+ Add" list="labelSuggestions" />
                </div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Assignees</div>
                <div class="assignees-container" id="assigneesContainer" data-assignees='${assigneesJson}'>
                    ${assigneesHtml}
                    <input type="text" class="add-assignee-input" id="addAssigneeInput" placeholder="+ Add" list="assigneeSuggestions" />
                </div>
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
        <div class="section-header">
            <div class="section-title">Description</div>
            <button class="edit-btn" id="editDescriptionBtn">Edit</button>
        </div>
        <div class="description-container">
            <div class="markdown-content description-view" id="descriptionView">${descriptionHtml}</div>
            <textarea class="description-textarea hidden" id="descriptionTextarea" placeholder="Add a description...">${this.escapeHtml(descriptionValue)}</textarea>
        </div>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            Open Raw Markdown
        </button>
        <button class="archive-btn" id="archiveBtn" style="background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); margin-left: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            Archive Task
        </button>
    </div>

    <!-- Autocomplete datalists -->
    <datalist id="labelSuggestions">
        ${uniqueLabels.map((l) => `<option value="${this.escapeHtml(l)}">`).join('')}
    </datalist>
    <datalist id="assigneeSuggestions">
        ${uniqueAssignees.map((a) => `<option value="${this.escapeHtml(a)}">`).join('')}
    </datalist>

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

        // Description view/edit toggle
        const descriptionView = document.getElementById('descriptionView');
        const descriptionTextarea = document.getElementById('descriptionTextarea');
        const editDescriptionBtn = document.getElementById('editDescriptionBtn');
        let isEditingDescription = false;
        let descriptionTimeout;

        function toggleDescriptionEdit(editing) {
            isEditingDescription = editing;
            if (editing) {
                descriptionView.classList.add('hidden');
                descriptionTextarea.classList.remove('hidden');
                descriptionTextarea.focus();
                editDescriptionBtn.textContent = 'Done';
            } else {
                descriptionView.classList.remove('hidden');
                descriptionTextarea.classList.add('hidden');
                editDescriptionBtn.textContent = 'Edit';
            }
        }

        editDescriptionBtn.addEventListener('click', () => {
            if (isEditingDescription) {
                // Save and switch to view mode
                vscode.postMessage({ type: 'updateField', field: 'description', value: descriptionTextarea.value });
            } else {
                toggleDescriptionEdit(true);
            }
        });

        // Also allow clicking the view to edit
        descriptionView.addEventListener('click', () => {
            toggleDescriptionEdit(true);
        });

        descriptionTextarea.addEventListener('input', () => {
            clearTimeout(descriptionTimeout);
            descriptionTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'updateField', field: 'description', value: descriptionTextarea.value });
            }, 1000); // Debounce: save after 1s of no typing
        });

        // Escape to cancel, blur to save
        descriptionTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                toggleDescriptionEdit(false);
            }
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

        // Assignees management
        const assigneesContainer = document.getElementById('assigneesContainer');
        const addAssigneeInput = document.getElementById('addAssigneeInput');
        let currentAssignees = JSON.parse(assigneesContainer.dataset.assignees || '[]');

        // Remove assignee
        document.querySelectorAll('.remove-assignee').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const assigneeSpan = btn.parentElement;
                const assigneeToRemove = assigneeSpan.dataset.assignee;
                currentAssignees = currentAssignees.filter(a => a !== assigneeToRemove);
                vscode.postMessage({ type: 'updateField', field: 'assignee', value: currentAssignees });
            });
        });

        // Add assignee
        addAssigneeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const newAssignee = addAssigneeInput.value.trim();
                if (newAssignee && !currentAssignees.includes(newAssignee)) {
                    currentAssignees.push(newAssignee);
                    vscode.postMessage({ type: 'updateField', field: 'assignee', value: currentAssignees });
                }
                addAssigneeInput.value = '';
            } else if (e.key === 'Escape') {
                addAssigneeInput.value = '';
                addAssigneeInput.blur();
            }
        });

        // Archive task
        document.getElementById('archiveBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'archiveTask', taskId: '${task.id}' });
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
