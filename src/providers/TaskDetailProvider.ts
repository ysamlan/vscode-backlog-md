import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BacklogParser, computeSubtasks } from '../core/BacklogParser';
import { BacklogWriter, computeContentHash, FileConflictError } from '../core/BacklogWriter';
import type { Task } from '../core/types';

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
 * Task detail data structure sent to the webview
 */
interface TaskDetailData {
  task: Task;
  statuses: string[];
  priorities: string[];
  uniqueLabels: string[];
  uniqueAssignees: string[];
  milestones: string[];
  blocksTaskIds: string[];
  isBlocked: boolean;
  descriptionHtml: string;
  isDraft?: boolean;
  isArchived?: boolean;
  parentTask?: { id: string; title: string };
  subtaskSummaries?: Array<{ id: string; title: string; status: string }>;
}

/**
 * Provides a webview panel for displaying task details
 *
 * This provider loads a compiled Svelte component (TaskDetail.svelte) that handles
 * all UI rendering. The provider is responsible for:
 * - Loading the Svelte bundle and styles
 * - Computing task data and sending it via postMessage
 * - Handling field updates and checklist toggles from the webview
 * - Conflict detection when files are modified externally
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
   */
  public static onFileChanged(uri: vscode.Uri, provider: TaskDetailProvider): void {
    if (!this.currentPanel || !this.currentTaskId || !this.currentFilePath) {
      return;
    }

    if (uri.fsPath === this.currentFilePath) {
      if (!fs.existsSync(uri.fsPath)) {
        vscode.window.showWarningMessage(
          `Task file was deleted: ${uri.fsPath.split('/').pop() || uri.fsPath}`
        );
        this.currentPanel?.dispose();
        return;
      }

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

    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it and update content
    if (TaskDetailProvider.currentPanel) {
      TaskDetailProvider.currentPanel.reveal(column);
      TaskDetailProvider.currentPanel.title = `${task.id}: ${task.title}`;
      TaskDetailProvider.currentTaskId = taskId;
      await this.sendTaskData(TaskDetailProvider.currentPanel.webview, task);
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
    panel.webview.html = this.getHtmlContent(panel.webview, task.title);

    // Send task data after a short delay to ensure component is mounted
    setTimeout(() => this.sendTaskData(panel.webview, task), 100);

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
   * Get URI for a resource file
   */
  private getResourceUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', ...pathSegments)
    );
  }

  /**
   * Generate HTML content for the webview (loads Svelte bundle)
   */
  private getHtmlContent(webview: vscode.Webview, taskTitle: string): string {
    const styleUri = this.getResourceUri(webview, 'styles.css');
    const scriptUri = this.getResourceUri(webview, 'task-detail.js');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>${this.escapeHtml(taskTitle)}</title>
</head>
<body class="task-detail-page">
    <div id="app"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Send task data to the webview
   */
  private async sendTaskData(webview: vscode.Webview, task: Task): Promise<void> {
    if (!this.parser) return;

    try {
      // Fetch all supporting data
      const [statuses, uniqueLabels, uniqueAssignees, configMilestones, allTasks, blocksTaskIds] =
        await Promise.all([
          this.parser.getStatuses(),
          this.parser.getUniqueLabels(),
          this.parser.getUniqueAssignees(),
          this.parser.getMilestones(),
          this.parser.getTasks(),
          this.parser.getBlockedByThisTask(task.id),
        ]);

      // Combine config milestones with unique milestones from tasks
      const configMilestoneNames = configMilestones.map((m) => m.name);
      const taskMilestones = [...new Set(allTasks.map((t) => t.milestone).filter(Boolean))];
      const milestones = [
        ...configMilestoneNames,
        ...taskMilestones.filter((m) => !configMilestoneNames.includes(m!)),
      ] as string[];

      // Check if task is blocked by incomplete dependencies
      let isBlocked = false;
      if (task.dependencies.length > 0) {
        const depTasks = await Promise.all(
          task.dependencies.map((depId) => this.parser!.getTask(depId))
        );
        isBlocked = depTasks.some((depTask) => depTask && depTask.status !== 'Done');
      }

      // Parse description markdown
      const descriptionHtml = task.description ? await parseMarkdown(task.description) : '';

      // Compute parent task info
      let parentTask: { id: string; title: string } | undefined;
      if (task.parentTaskId) {
        const parent = await this.parser!.getTask(task.parentTaskId);
        if (parent) {
          parentTask = { id: parent.id, title: parent.title };
        }
      }

      // Compute subtask summaries
      computeSubtasks(allTasks);
      let subtaskSummaries: Array<{ id: string; title: string; status: string }> | undefined;
      const thisTask = allTasks.find((t) => t.id === task.id);
      if (thisTask?.subtasks && thisTask.subtasks.length > 0) {
        const summaries: Array<{ id: string; title: string; status: string }> = [];
        for (const childId of thisTask.subtasks) {
          const child = allTasks.find((t) => t.id === childId);
          if (child) {
            summaries.push({ id: child.id, title: child.title, status: child.status });
          }
        }
        if (summaries.length > 0) {
          subtaskSummaries = summaries;
        }
      }

      const data: TaskDetailData = {
        task,
        statuses,
        priorities: ['high', 'medium', 'low'],
        uniqueLabels,
        uniqueAssignees,
        milestones,
        blocksTaskIds,
        isBlocked,
        descriptionHtml,
        isDraft: task.folder === 'drafts',
        isArchived: task.folder === 'archive',
        parentTask,
        subtaskSummaries,
      };

      webview.postMessage({ type: 'taskData', data });
    } catch (error) {
      console.error('[Backlog.md] Error sending task data:', error);
      webview.postMessage({ type: 'error', message: 'Failed to load task data' });
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: {
    type: string;
    taskId?: string;
    parentTaskId?: string;
    listType?: 'acceptanceCriteria' | 'definitionOfDone';
    itemId?: number;
    field?: string;
    value?: string | string[];
    label?: string;
  }): Promise<void> {
    switch (message.type) {
      case 'refresh':
        if (TaskDetailProvider.currentTaskId) {
          await this.openTask(TaskDetailProvider.currentTaskId);
        }
        break;

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

      case 'filterByLabel':
        if (message.label) {
          vscode.commands.executeCommand('backlog.filterByLabel', message.label);
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
            await this.openTask(TaskDetailProvider.currentTaskId);
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle checklist item: ${error}`);
          }
        }
        break;

      case 'updateField':
        if (TaskDetailProvider.currentTaskId && this.parser && message.field) {
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

      case 'promoteDraft': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        try {
          await this.writer.promoteDraft(TaskDetailProvider.currentTaskId, this.parser);
          vscode.window.showInformationMessage(
            `Draft promoted to task: ${TaskDetailProvider.currentTaskId}`
          );
          await this.openTask(TaskDetailProvider.currentTaskId);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to promote draft: ${error}`);
        }
        break;
      }

      case 'discardDraft': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        const draftTask = await this.parser.getTask(TaskDetailProvider.currentTaskId);
        if (!draftTask) break;

        const discardConfirmation = await vscode.window.showWarningMessage(
          `Discard draft "${draftTask.title}"? This will permanently delete the file.`,
          { modal: true },
          'Discard'
        );

        if (discardConfirmation === 'Discard') {
          try {
            if (draftTask.filePath && fs.existsSync(draftTask.filePath)) {
              fs.unlinkSync(draftTask.filePath);
            }
            vscode.window.showInformationMessage('Draft discarded');
            TaskDetailProvider.currentPanel?.dispose();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to discard draft: ${error}`);
          }
        }
        break;
      }

      case 'archiveTask': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        try {
          await this.writer.archiveTask(TaskDetailProvider.currentTaskId, this.parser);
          vscode.window.showInformationMessage(`Task ${TaskDetailProvider.currentTaskId} archived`);
          TaskDetailProvider.currentPanel?.dispose();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to archive task: ${error}`);
        }
        break;
      }

      case 'restoreTask': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        try {
          await this.writer.restoreArchivedTask(TaskDetailProvider.currentTaskId, this.parser);
          vscode.window.showInformationMessage(
            `Task ${TaskDetailProvider.currentTaskId} restored to tasks`
          );
          TaskDetailProvider.currentPanel?.dispose();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to restore task: ${error}`);
        }
        break;
      }

      case 'deleteTask': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        const deleteTarget = await this.parser.getTask(TaskDetailProvider.currentTaskId);
        if (!deleteTarget) break;

        const deleteConfirmation = await vscode.window.showWarningMessage(
          `Permanently delete task "${deleteTarget.title}"? This cannot be undone.`,
          { modal: true },
          'Delete'
        );

        if (deleteConfirmation === 'Delete') {
          try {
            await this.writer.deleteTask(TaskDetailProvider.currentTaskId, this.parser);
            vscode.window.showInformationMessage(
              `Task ${TaskDetailProvider.currentTaskId} deleted`
            );
            TaskDetailProvider.currentPanel?.dispose();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
          }
        }
        break;
      }

      case 'createSubtask': {
        if (!message.parentTaskId || !this.parser) break;

        try {
          const backlogPath = path.dirname(
            path.dirname((await this.parser.getTask(message.parentTaskId))?.filePath || '')
          );
          if (!backlogPath) break;

          const result = await this.writer.createSubtask(
            message.parentTaskId,
            backlogPath,
            this.parser
          );

          // Open the new subtask in the detail panel
          await this.openTask(result.id);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create subtask: ${error}`);
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
        await this.openTask(taskId);
        break;

      case 'Overwrite Anyway': {
        try {
          const updates: Record<string, unknown> = {};
          updates[field] = value;
          await this.writer.updateTask(taskId, updates, this.parser);
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
        if (task?.filePath) {
          await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(task.filePath));
        }
        break;
    }
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
