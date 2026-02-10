import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BacklogParser, computeSubtasks } from '../core/BacklogParser';
import { BacklogWriter, computeContentHash, FileConflictError } from '../core/BacklogWriter';
import { isReadOnlyTask, getReadOnlyTaskContext, type Task, type TaskSource } from '../core/types';
import { sanitizeMarkdownSource } from '../core/sanitizeMarkdown';

// Dynamic import for marked (ESM module)
let markedParse: ((markdown: string) => string | Promise<string>) | null = null;
async function parseMarkdown(markdown: string): Promise<string> {
  if (!markedParse) {
    const { marked } = await import('marked');
    marked.setOptions({ gfm: true, breaks: true });
    markedParse = marked.parse;
  }
  const safe = sanitizeMarkdownSource(markdown);
  const result = markedParse(safe);
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
  missingDependencyIds?: string[];
  descriptionHtml: string;
  isDraft?: boolean;
  isArchived?: boolean;
  isReadOnly?: boolean;
  readOnlyReason?: string;
  parentTask?: { id: string; title: string };
  subtaskSummaries?: Array<{ id: string; title: string; status: string }>;
}

interface OpenTaskRequest {
  taskId: string;
  filePath?: string;
  source?: TaskSource;
  branch?: string;
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
  private static currentTaskRef: OpenTaskRequest | undefined;
  private static currentFileHash: string | undefined;
  private static currentFilePath: string | undefined;
  private readonly writer = new BacklogWriter();

  /**
   * Get the currently displayed task ID (for command palette commands)
   */
  public static getCurrentTaskId(): string | undefined {
    return TaskDetailProvider.currentTaskId;
  }

  /**
   * Check if a task detail panel is currently active and visible
   */
  public static hasActivePanel(): boolean {
    return TaskDetailProvider.currentPanel !== undefined && TaskDetailProvider.currentPanel.visible;
  }

  private static onActiveTaskChangedCallback: ((taskId: string | null) => void) | undefined;

  /**
   * Register a callback that fires when the active edited task changes
   */
  public static onActiveTaskChanged(callback: (taskId: string | null) => void): void {
    TaskDetailProvider.onActiveTaskChangedCallback = callback;
  }

  private static notifyActiveTaskChanged(taskId: string | null): void {
    TaskDetailProvider.onActiveTaskChangedCallback?.(taskId);
  }

  constructor(
    private readonly extensionUri: vscode.Uri,
    private parser: BacklogParser | undefined
  ) {}

  setParser(parser: BacklogParser): void {
    this.parser = parser;
  }

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

      provider.openTask(this.currentTaskRef ?? this.currentTaskId);
    }
  }

  /**
   * Open or update the task detail panel for a specific task
   */
  async openTask(
    taskRef: string | OpenTaskRequest,
    options?: { preserveFocus?: boolean }
  ): Promise<void> {
    if (!this.parser) {
      vscode.window.showErrorMessage('No backlog folder found');
      return;
    }

    const requestedTask = typeof taskRef === 'string' ? { taskId: taskRef } : taskRef;
    const task = await this.resolveTaskForOpen(requestedTask);
    if (!task) {
      vscode.window.showErrorMessage(`Task ${requestedTask.taskId} not found`);
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
      TaskDetailProvider.currentPanel.reveal(column, options?.preserveFocus);
      TaskDetailProvider.currentPanel.title = `${task.id}: ${task.title}`;
      TaskDetailProvider.currentTaskId = task.id;
      TaskDetailProvider.currentTaskRef = {
        taskId: task.id,
        filePath: task.filePath,
        source: task.source,
        branch: task.branch,
      };
      await this.sendTaskData(TaskDetailProvider.currentPanel.webview, task);
      TaskDetailProvider.notifyActiveTaskChanged(task.id);
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
    TaskDetailProvider.currentTaskId = task.id;
    TaskDetailProvider.currentTaskRef = {
      taskId: task.id,
      filePath: task.filePath,
      source: task.source,
      branch: task.branch,
    };
    panel.webview.html = this.getHtmlContent(panel.webview, task.title);

    // Send task data after a short delay to ensure component is mounted
    setTimeout(() => this.sendTaskData(panel.webview, task), 100);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    // Track visibility changes for active task highlighting
    panel.onDidChangeViewState(() => {
      if (panel.visible) {
        TaskDetailProvider.notifyActiveTaskChanged(TaskDetailProvider.currentTaskId ?? null);
      } else {
        TaskDetailProvider.notifyActiveTaskChanged(null);
      }
    });

    // Reset when the panel is closed
    panel.onDidDispose(() => {
      TaskDetailProvider.currentPanel = undefined;
      TaskDetailProvider.currentTaskId = undefined;
      TaskDetailProvider.currentTaskRef = undefined;
      TaskDetailProvider.currentFileHash = undefined;
      TaskDetailProvider.currentFilePath = undefined;
      TaskDetailProvider.notifyActiveTaskChanged(null);
    });

    TaskDetailProvider.notifyActiveTaskChanged(task.id);
  }

  /**
   * Resolve a task by identity for detail-open actions.
   * Prefers exact filePath matches from cross-branch task loading when provided,
   * while preserving local getTask behavior for legacy ID-only callers.
   */
  private async resolveTaskForOpen(taskRef: OpenTaskRequest): Promise<Task | undefined> {
    if (!this.parser) return undefined;

    const localTask = await this.parser.getTask(taskRef.taskId);
    const hasExtendedIdentity = Boolean(taskRef.filePath || taskRef.source || taskRef.branch);
    if (!hasExtendedIdentity) {
      return localTask;
    }

    if (localTask?.filePath && taskRef.filePath && localTask.filePath === taskRef.filePath) {
      return localTask;
    }

    const crossBranchTasks = await this.parser.getTasksWithCrossBranch();

    if (taskRef.filePath) {
      const exactByPath = crossBranchTasks.find(
        (task) => task.id === taskRef.taskId && task.filePath === taskRef.filePath
      );
      if (exactByPath) return exactByPath;
    }

    const bySource = crossBranchTasks.find(
      (task) =>
        task.id === taskRef.taskId &&
        task.source === taskRef.source &&
        task.branch === taskRef.branch
    );
    if (bySource) return bySource;

    return localTask ?? crossBranchTasks.find((task) => task.id === taskRef.taskId);
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
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
      const contextTasks = await this.getContextTasks(task);
      const contextTask = this.resolveTaskFromCollection(contextTasks, task) ?? task;

      // Fetch all supporting data
      const [
        statuses,
        uniqueLabels,
        uniqueAssignees,
        configMilestones,
        completedTasks,
        archivedTasks,
      ] = await Promise.all([
        this.parser.getStatuses(),
        this.parser.getUniqueLabels(),
        this.parser.getUniqueAssignees(),
        this.parser.getMilestones(),
        this.parser.getCompletedTasks(),
        this.parser.getArchivedTasks(),
      ]);

      // Combine config milestones with unique milestones from tasks
      const configMilestoneNames = configMilestones.map((m) => m.name);
      const taskMilestones = [...new Set(contextTasks.map((t) => t.milestone).filter(Boolean))];
      const milestones = [
        ...configMilestoneNames,
        ...taskMilestones.filter((m) => !configMilestoneNames.includes(m!)),
      ] as string[];

      const blocksTaskIds = contextTasks
        .filter((candidateTask) => candidateTask.dependencies.includes(contextTask.id))
        .map((candidateTask) => candidateTask.id);

      // Check if task is blocked by active dependencies and track unresolved links
      const doneStatus = statuses.length > 0 ? statuses[statuses.length - 1] : 'Done';
      const activeTaskById = new Map(contextTasks.map((activeTask) => [activeTask.id, activeTask]));
      const completedTaskIds = new Set(completedTasks.map((completedTask) => completedTask.id));
      const archivedTaskIds = new Set(archivedTasks.map((archivedTask) => archivedTask.id));
      const missingDependencyIds: string[] = [];
      const blockingDependencyIds = contextTask.dependencies.filter((depId) => {
        if (completedTaskIds.has(depId) || archivedTaskIds.has(depId)) {
          return false;
        }
        const depTask = activeTaskById.get(depId);
        if (!depTask) {
          missingDependencyIds.push(depId);
          return true;
        }
        return depTask.status !== doneStatus;
      });
      const isBlocked = blockingDependencyIds.length > 0;

      // Parse description markdown
      const descriptionHtml = task.description ? await parseMarkdown(task.description) : '';

      // Compute parent task info
      let parentTask: { id: string; title: string } | undefined;
      if (contextTask.parentTaskId) {
        let parent = this.findPreferredTaskById(
          contextTasks,
          contextTask.parentTaskId,
          contextTask
        );
        if (!parent) {
          parent = await this.parser!.getTask(contextTask.parentTaskId);
        }
        if (parent) {
          parentTask = { id: parent.id, title: parent.title };
        }
      }

      // Compute subtask summaries
      computeSubtasks(contextTasks);
      let subtaskSummaries: Array<{ id: string; title: string; status: string }> | undefined;
      if (contextTask.subtasks && contextTask.subtasks.length > 0) {
        const summaries: Array<{ id: string; title: string; status: string }> = [];
        for (const childId of contextTask.subtasks) {
          const child = this.findPreferredTaskById(contextTasks, childId, contextTask);
          if (child) {
            summaries.push({ id: child.id, title: child.title, status: child.status });
          }
        }
        if (summaries.length > 0) {
          subtaskSummaries = summaries;
        }
      }

      const data: TaskDetailData = {
        task: contextTask,
        statuses,
        priorities: ['high', 'medium', 'low'],
        uniqueLabels,
        uniqueAssignees,
        milestones,
        blocksTaskIds,
        isBlocked,
        missingDependencyIds: missingDependencyIds.length > 0 ? missingDependencyIds : undefined,
        descriptionHtml,
        isDraft: task.folder === 'drafts',
        isArchived: task.folder === 'archive',
        isReadOnly: isReadOnlyTask(task),
        readOnlyReason: isReadOnlyTask(task)
          ? `Task is from ${getReadOnlyTaskContext(task)} and is read-only.`
          : undefined,
        parentTask,
        subtaskSummaries,
      };

      webview.postMessage({ type: 'taskData', data });
    } catch (error) {
      console.error('[Backlog.md] Error sending task data:', error);
      webview.postMessage({ type: 'error', message: 'Failed to load task data' });
    }
  }

  private async getContextTasks(task: Task): Promise<Task[]> {
    if (!this.parser) return [];
    if (task.source === 'remote' || task.source === 'local-branch') {
      return this.parser.getTasksWithCrossBranch();
    }
    return this.parser.getTasks();
  }

  private resolveTaskFromCollection(tasks: Task[], task: Task): Task | undefined {
    if (task.filePath) {
      const byPath = tasks.find(
        (candidate) => candidate.id === task.id && candidate.filePath === task.filePath
      );
      if (byPath) return byPath;
    }
    const bySource = tasks.find(
      (candidate) =>
        candidate.id === task.id &&
        candidate.source === task.source &&
        candidate.branch === task.branch
    );
    if (bySource) return bySource;
    return tasks.find((candidate) => candidate.id === task.id);
  }

  private findPreferredTaskById(
    tasks: Task[],
    taskId: string,
    contextTask: Task
  ): Task | undefined {
    const sameSourceAndBranch = tasks.find(
      (candidate) =>
        candidate.id === taskId &&
        candidate.source === contextTask.source &&
        candidate.branch === contextTask.branch
    );
    if (sameSourceAndBranch) return sameSourceAndBranch;

    const sameSource = tasks.find(
      (candidate) => candidate.id === taskId && candidate.source === contextTask.source
    );
    if (sameSource) return sameSource;

    return tasks.find((candidate) => candidate.id === taskId);
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
          await this.openTask(
            TaskDetailProvider.currentTaskRef ?? { taskId: TaskDetailProvider.currentTaskId }
          );
        }
        break;

      case 'openFile':
        if (TaskDetailProvider.currentTaskId && this.parser) {
          const task = await this.getCurrentTaskFromContext();
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
          const currentTask = await this.getCurrentTaskFromContext();
          if (this.blockReadOnlyMutation(currentTask, 'update checklist items')) break;
          try {
            await this.writer.toggleChecklistItem(
              TaskDetailProvider.currentTaskId,
              message.listType,
              message.itemId,
              this.parser
            );
            await this.openTask(
              TaskDetailProvider.currentTaskRef ?? { taskId: TaskDetailProvider.currentTaskId }
            );
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle checklist item: ${error}`);
          }
        }
        break;

      case 'updateField':
        if (TaskDetailProvider.currentTaskId && this.parser && message.field) {
          const task = await this.getCurrentTaskFromContext();
          if (this.blockReadOnlyMutation(task, `update ${message.field}`)) break;
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
            await this.openTask(
              TaskDetailProvider.currentTaskRef ?? { taskId: TaskDetailProvider.currentTaskId }
            );
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
        const task = await this.getCurrentTaskFromContext();
        if (this.blockReadOnlyMutation(task, 'promote this draft')) break;

        try {
          const newTaskId = await this.writer.promoteDraft(
            TaskDetailProvider.currentTaskId,
            this.parser
          );
          vscode.window.showInformationMessage(`Draft promoted to task: ${newTaskId}`);
          await this.openTask(newTaskId);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to promote draft: ${error}`);
        }
        break;
      }

      case 'discardDraft': {
        if (!TaskDetailProvider.currentTaskId || !this.parser) break;

        const draftTask = await this.getCurrentTaskFromContext();
        if (this.blockReadOnlyMutation(draftTask, 'discard this draft')) break;
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
        const task = await this.getCurrentTaskFromContext();
        if (this.blockReadOnlyMutation(task, 'archive this task')) break;

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
        const task = await this.getCurrentTaskFromContext();
        if (this.blockReadOnlyMutation(task, 'restore this task')) break;

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

        const deleteTarget = await this.getCurrentTaskFromContext();
        if (this.blockReadOnlyMutation(deleteTarget, 'delete this task')) break;
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
        const parentTask =
          TaskDetailProvider.currentTaskRef &&
          TaskDetailProvider.currentTaskRef.taskId === message.parentTaskId
            ? await this.resolveTaskForOpen(TaskDetailProvider.currentTaskRef)
            : await this.parser.getTask(message.parentTaskId);
        if (this.blockReadOnlyMutation(parentTask, 'create a subtask')) break;

        try {
          const backlogPath = path.dirname(path.dirname(parentTask?.filePath || ''));
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

  private blockReadOnlyMutation(task: Task | undefined, action: string): boolean {
    if (!task || !isReadOnlyTask(task)) return false;
    vscode.window.showErrorMessage(
      `Cannot ${action}: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`
    );
    return true;
  }

  private async getCurrentTaskFromContext(): Promise<Task | undefined> {
    if (!this.parser || !TaskDetailProvider.currentTaskId) {
      return undefined;
    }
    if (TaskDetailProvider.currentTaskRef) {
      return this.resolveTaskForOpen(TaskDetailProvider.currentTaskRef);
    }
    return this.parser.getTask(TaskDetailProvider.currentTaskId);
  }
}
