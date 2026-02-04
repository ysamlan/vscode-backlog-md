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
  private static currentFilePath: string | undefined;
  private readonly writer = new BacklogWriter();

  /**
   * Get the currently displayed task ID (for command palette commands)
   */
  public static getCurrentTaskId(): string | undefined {
    return TaskDetailProvider.currentTaskId;
  }

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly parser: BacklogParser | undefined
  ) {}

  /**
   * Handle file change events from the FileWatcher.
   * Refreshes the view if the changed file matches the currently displayed task.
   * @param uri The URI of the changed file
   * @param provider The TaskDetailProvider instance to use for refreshing
   */
  public static onFileChanged(uri: vscode.Uri, provider: TaskDetailProvider): void {
    // Only proceed if panel exists and is showing a task
    if (!this.currentPanel || !this.currentTaskId || !this.currentFilePath) {
      return;
    }

    // Check if the changed file matches the currently displayed task
    if (uri.fsPath === this.currentFilePath) {
      // Check if file was deleted
      if (!fs.existsSync(uri.fsPath)) {
        vscode.window.showWarningMessage(
          `Task file was deleted: ${uri.fsPath.split('/').pop() || uri.fsPath}`
        );
        this.currentPanel?.dispose();
        return;
      }

      // Reload the task - this will also update the hash
      provider.openTask(this.currentTaskId);
    }
  }

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

    // Capture file state for conflict detection and auto-refresh
    if (task.filePath && fs.existsSync(task.filePath)) {
      const fileContent = fs.readFileSync(task.filePath, 'utf-8');
      TaskDetailProvider.currentFileHash = computeContentHash(fileContent);
      TaskDetailProvider.currentFilePath = task.filePath;
    } else {
      TaskDetailProvider.currentFileHash = undefined;
      TaskDetailProvider.currentFilePath = undefined;
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
      TaskDetailProvider.currentFilePath = undefined;
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
            vscode.window.showInformationMessage(
              `Task ${TaskDetailProvider.currentTaskId} archived`
            );
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

    // Fetch unique labels, assignees, and reverse dependencies for autocomplete and dependency visualization
    const [uniqueLabels, uniqueAssignees, blocksTaskIds] = await Promise.all([
      this.parser!.getUniqueLabels(),
      this.parser!.getUniqueAssignees(),
      this.parser!.getBlockedByThisTask(task.id),
    ]);

    // Check if any dependencies are not Done (task is blocked)
    let isBlocked = false;
    if (task.dependencies.length > 0) {
      const depTasks = await Promise.all(
        task.dependencies.map((depId) => this.parser!.getTask(depId))
      );
      isBlocked = depTasks.some((depTask) => depTask && depTask.status !== 'Done');
    }

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

    // "Blocked By" - tasks this task depends on (must complete before this task)
    const blockedByHtml =
      task.dependencies.length > 0
        ? task.dependencies
            .map(
              (d) =>
                `<a href="#" class="dependency-link" data-task-id="${this.escapeHtml(d)}">${this.escapeHtml(d)}</a>`
            )
            .join(', ')
        : '<span class="empty-value">None</span>';

    // "Blocks" - tasks that depend on this task (cannot start until this completes)
    const blocksHtml =
      blocksTaskIds.length > 0
        ? blocksTaskIds
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
</head>
<body class="task-detail-page">
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
            ${isBlocked ? '<span class="blocked-badge">Blocked</span>' : ''}
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
                <div class="meta-label">Blocked By</div>
                <div>${blockedByHtml}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Blocks</div>
                <div>${blocksHtml}</div>
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
        <button class="archive-btn" id="archiveBtn">
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
