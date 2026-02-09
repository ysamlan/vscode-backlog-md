import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import {
  WebviewMessage,
  DataSourceMode,
  Task,
  TaskSource,
  TaskIdDisplayMode,
  TasksViewSettings,
  isReadOnlyTask,
  getReadOnlyTaskContext,
} from '../core/types';
import { BacklogWriter } from '../core/BacklogWriter';
import { computeSubtasks } from '../core/BacklogParser';

/**
 * Provides a unified tasks webview with toggle between Kanban and List views
 *
 * This provider loads a compiled Svelte component (Tasks.svelte) that handles
 * all UI rendering including Kanban board and List view. The provider is responsible for:
 * - Loading the Svelte bundle and styles
 * - Sending tasks, statuses, and milestones to the webview
 * - Handling task updates (status changes, reordering)
 * - Persisting view preferences (viewMode, milestoneGrouping, collapsed columns)
 */
export class TasksViewProvider extends BaseViewProvider {
  private viewMode: 'kanban' | 'list' | 'drafts' | 'archived' | 'dashboard' | 'docs' | 'decisions' =
    'kanban';
  private milestoneGrouping: boolean = false;
  private dataSourceMode: DataSourceMode = 'local-only';
  private dataSourceReason?: string;
  private collapsedColumns: Set<string> = new Set();
  private collapsedMilestones: Set<string> = new Set();
  private onSelectTask?: (taskRef: {
    taskId: string;
    filePath?: string;
    source?: TaskSource;
    branch?: string;
  }) => void | Promise<void>;

  private getTasksViewSettings(): TasksViewSettings {
    const configuredMode = vscode.workspace
      .getConfiguration('backlog')
      .get<TaskIdDisplayMode>('taskIdDisplay', 'full');

    const taskIdDisplay: TaskIdDisplayMode =
      configuredMode === 'number' || configuredMode === 'hidden' ? configuredMode : 'full';

    return { taskIdDisplay };
  }

  protected get viewType(): string {
    return 'backlog.kanban';
  }

  setTaskSelectionHandler(
    handler: (taskRef: {
      taskId: string;
      filePath?: string;
      source?: TaskSource;
      branch?: string;
    }) => void | Promise<void>
  ): void {
    this.onSelectTask = handler;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    resolveContext: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    // Load saved view mode, milestone grouping, and collapsed columns from globalState
    if (this.context) {
      // Derive from saved state: check legacy showingDrafts flag for migration
      const legacyDrafts = this.context.globalState.get<boolean>('backlog.showingDrafts', false);
      this.viewMode = legacyDrafts
        ? 'drafts'
        : this.context.globalState.get<
            'kanban' | 'list' | 'drafts' | 'archived' | 'dashboard' | 'docs' | 'decisions'
          >('backlog.viewMode', 'kanban');
      this.milestoneGrouping = this.context.globalState.get('backlog.milestoneGrouping', false);
      const savedCollapsed = this.context.globalState.get<string[]>('backlog.collapsedColumns', []);
      this.collapsedColumns = new Set(savedCollapsed);
      const savedCollapsedMilestones = this.context.globalState.get<string[]>(
        'backlog.collapsedMilestones',
        []
      );
      this.collapsedMilestones = new Set(savedCollapsedMilestones);
    }
    return super.resolveWebviewView(webviewView, resolveContext, token);
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const styleUri = this.getResourceUri(webview, 'styles.css');
    const componentStyleUri = this.getResourceUri(webview, 'tasks.css');
    const scriptUri = this.getResourceUri(webview, 'tasks.js');

    // CSP allows our script and ES module imports from the same origin
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <link href="${componentStyleUri}" rel="stylesheet">
    <title>Tasks</title>
</head>
<body class="tasks-page">
    <div id="app"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Override refresh to also send statuses from config.
   * Uses cross-branch loading when configured.
   */
  async refresh(): Promise<void> {
    if (!this._view) return;

    if (!this.parser) {
      this.postMessage({ type: 'noBacklogFolder' });
      return;
    }

    try {
      // Determine which tasks to load based on mode
      if (this.viewMode === 'dashboard') {
        await this.refreshDashboard();
        return;
      }

      if (this.viewMode === 'docs') {
        await this.refreshDocuments();
        return;
      }

      if (this.viewMode === 'decisions') {
        await this.refreshDecisions();
        return;
      }

      // Read config for project name and cross-branch mode
      const config = await this.parser.getConfig();
      this.postMessage({
        type: 'configUpdated',
        config: { projectName: config.project_name },
      });
      this.postMessage({ type: 'settingsUpdated', settings: this.getTasksViewSettings() });

      // Activate cross-branch mode from config
      if (config.check_active_branches) {
        this.dataSourceMode = 'cross-branch';
      }

      let taskLoader: Promise<Task[]>;
      if (this.viewMode === 'archived') {
        taskLoader = this.parser.getArchivedTasks();
      } else if (this.viewMode === 'drafts') {
        taskLoader = this.parser.getDrafts();
      } else if (this.dataSourceMode === 'cross-branch') {
        taskLoader = this.parser.getTasksWithCrossBranch();
      } else {
        taskLoader = this.parser.getTasks();
      }

      const [tasks, statuses, milestones, draftCountFromFolder, completedTasks, archivedTasks] =
        await Promise.all([
          taskLoader,
          this.parser.getStatuses(),
          this.parser.getMilestones(),
          this.viewMode !== 'drafts'
            ? this.parser.getDrafts().then((d) => d.length)
            : Promise.resolve(0),
          this.parser.getCompletedTasks(),
          this.parser.getArchivedTasks(),
        ]);

      // Compute subtask relationships from parentTaskId fields
      computeSubtasks(tasks);

      // The last configured status is treated as the "done" status
      const doneStatus = statuses.length > 0 ? statuses[statuses.length - 1] : 'Done';
      const completedTaskIds = new Set(completedTasks.map((task) => task.id));
      const archivedTaskIds = new Set(archivedTasks.map((task) => task.id));

      // Build reverse dependency map and task-by-id lookup once — O(n)
      const taskById = new Map<string, Task>();
      const reverseDeps = new Map<string, string[]>();
      for (const task of tasks) {
        taskById.set(task.id, task);
        for (const depId of task.dependencies) {
          let blocked = reverseDeps.get(depId);
          if (!blocked) {
            blocked = [];
            reverseDeps.set(depId, blocked);
          }
          blocked.push(task.id);
        }
      }

      const tasksWithBlocks = tasks.map((task) => {
        const enhanced: Task & {
          blocksTaskIds?: string[];
          subtaskProgress?: { total: number; done: number };
          blockingDependencyIds?: string[];
        } = {
          ...task,
          blocksTaskIds: reverseDeps.get(task.id) || [],
        };
        const blockingDependencyIds = task.dependencies.filter((depId) => {
          if (completedTaskIds.has(depId) || archivedTaskIds.has(depId)) return false;
          const depTask = taskById.get(depId);
          if (!depTask) return true;
          return depTask.status !== doneStatus;
        });
        if (blockingDependencyIds.length > 0) {
          enhanced.blockingDependencyIds = blockingDependencyIds;
        }
        if (task.subtasks && task.subtasks.length > 0) {
          const total = task.subtasks.length;
          const done = task.subtasks.filter((childId) => {
            const child = taskById.get(childId);
            return child?.status === doneStatus;
          }).length;
          enhanced.subtaskProgress = { total, done };
        }
        return enhanced;
      });

      // Send initial state along with data
      this.postMessage({ type: 'activeTabChanged', tab: this.viewMode });
      // Backward compatibility: also send legacy messages
      this.postMessage({
        type: 'draftsModeChanged',
        enabled: this.viewMode === 'drafts',
      });
      this.postMessage({
        type: 'viewModeChanged',
        viewMode:
          this.viewMode === 'drafts' || this.viewMode === 'archived' ? 'list' : this.viewMode,
      });
      this.postMessage({
        type: 'columnCollapseChanged',
        collapsedColumns: Array.from(this.collapsedColumns),
      });
      this.postMessage({
        type: 'milestoneCollapseChanged',
        collapsedMilestones: Array.from(this.collapsedMilestones),
      });
      this.postMessage({ type: 'milestoneGroupingChanged', enabled: this.milestoneGrouping });
      this.postMessage({ type: 'statusesUpdated', statuses });
      this.postMessage({ type: 'milestonesUpdated', milestones });
      this.postMessage({ type: 'tasksUpdated', tasks: tasksWithBlocks });

      // Send draft count for tab badge
      const draftCount = this.viewMode === 'drafts' ? tasks.length : draftCountFromFolder;
      this.postMessage({ type: 'draftCountUpdated', count: draftCount });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing Tasks view:', error);
      this.postMessage({ type: 'error', message: 'Failed to load tasks' });
    }
  }

  protected async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'refresh':
        await this.refresh();
        break;

      case 'openTask': {
        vscode.commands.executeCommand('backlog.openTaskDetail', {
          taskId: message.taskId,
          filePath: message.filePath,
          source: message.source,
          branch: message.branch,
        });
        break;
      }

      case 'selectTask': {
        await this.onSelectTask?.({
          taskId: message.taskId,
          filePath: message.filePath,
          source: message.source,
          branch: message.branch,
        });
        break;
      }

      case 'focusTaskPreview': {
        await vscode.commands.executeCommand('backlog.taskPreview.focus');
        break;
      }

      case 'updateTaskStatus': {
        if (!this.parser) break;
        const taskId = message.taskId;
        // Get original status before update for rollback
        const task = await this.parser.getTask(taskId);
        if (task && isReadOnlyTask(task)) {
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus: task.status,
            message: `Cannot update status: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`,
          });
          break;
        }
        const originalStatus = task?.status || 'To Do';

        try {
          const writer = new BacklogWriter();
          // Update status and optionally ordinal (for cross-column drops with position)
          const updates: Partial<Task> = { status: message.status };
          if (message.ordinal !== undefined) {
            updates.ordinal = message.ordinal;
          }
          await writer.updateTask(taskId, updates, this.parser);

          // Also update any additional cards that needed ordinals assigned
          if (message.additionalOrdinalUpdates && message.additionalOrdinalUpdates.length > 0) {
            for (const update of message.additionalOrdinalUpdates) {
              await writer.updateTask(update.taskId, { ordinal: update.ordinal }, this.parser);
            }
          }

          // Send success - no need to refresh since we did optimistic update
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
        } catch (error) {
          console.error('Error updating task status:', error);
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus,
            message: 'Failed to update task status',
          });
        }
        break;
      }

      case 'updateTask': {
        if (!this.parser) break;
        const taskId = message.taskId;
        const task = await this.parser.getTask(taskId);
        if (!task) {
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus: 'To Do',
            message: `Task not found: ${taskId}`,
          });
          break;
        }
        if (isReadOnlyTask(task)) {
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus: task.status,
            message: `Cannot update task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`,
          });
          break;
        }

        const updates: Partial<Task> = {};
        if (typeof message.updates.status === 'string') {
          updates.status = message.updates.status;
        }
        if (
          message.updates.priority === 'high' ||
          message.updates.priority === 'medium' ||
          message.updates.priority === 'low' ||
          message.updates.priority === undefined
        ) {
          updates.priority = message.updates.priority;
        }

        if (Object.keys(updates).length === 0) break;

        try {
          const writer = new BacklogWriter();
          await writer.updateTask(taskId, updates, this.parser);
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
        } catch (error) {
          console.error('Error updating task:', error);
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus: task.status,
            message: 'Failed to update task',
          });
        }
        break;
      }

      case 'reorderTask': {
        if (!this.parser) break;
        const taskId = message.taskId;
        const task = await this.parser.getTask(taskId);
        if (task && isReadOnlyTask(task)) {
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus: task.status,
            message: `Cannot reorder task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`,
          });
          break;
        }
        try {
          const writer = new BacklogWriter();
          await writer.updateTask(taskId, { ordinal: message.ordinal }, this.parser);
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
        } catch (error) {
          console.error('Error reordering task:', error);
          // For reorder errors, just remove saving state - no need to restore position
          // since the UI already shows the new position optimistically
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
        }
        break;
      }

      case 'reorderTasks': {
        if (!this.parser) break;
        const readonlyTasks: Task[] = [];
        for (const update of message.updates) {
          const task = await this.parser.getTask(update.taskId);
          if (task && isReadOnlyTask(task)) {
            readonlyTasks.push(task);
          }
        }
        if (readonlyTasks.length > 0) {
          for (const task of readonlyTasks) {
            this.postMessage({
              type: 'taskUpdateError',
              taskId: task.id,
              originalStatus: task.status,
              message: `Cannot reorder task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`,
            });
          }
          for (const update of message.updates) {
            if (!readonlyTasks.some((t) => t.id === update.taskId)) {
              this.postMessage({ type: 'taskUpdateSuccess', taskId: update.taskId });
            }
          }
          break;
        }
        try {
          const writer = new BacklogWriter();
          // Update all tasks with new ordinals
          for (const update of message.updates) {
            await writer.updateTask(update.taskId, { ordinal: update.ordinal }, this.parser);
          }
          // Send success for each task
          for (const update of message.updates) {
            this.postMessage({ type: 'taskUpdateSuccess', taskId: update.taskId });
          }
        } catch (error) {
          console.error('Error reordering tasks:', error);
          // For reorder errors, just remove saving state
          for (const update of message.updates) {
            this.postMessage({ type: 'taskUpdateSuccess', taskId: update.taskId });
          }
        }
        break;
      }

      case 'archiveTask': {
        if (!this.parser || !message.taskId) break;
        const task = await this.parser.getTask(message.taskId);
        if (task && isReadOnlyTask(task)) {
          vscode.window.showErrorMessage(
            `Cannot archive task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`
          );
          break;
        }
        const confirmation = await vscode.window.showWarningMessage(
          `Archive task "${task?.title}"?`,
          { modal: true },
          'Archive'
        );

        if (confirmation === 'Archive') {
          try {
            const writer = new BacklogWriter();
            await writer.archiveTask(message.taskId, this.parser);
            await this.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive: ${error}`);
          }
        }
        break;
      }

      case 'completeTask': {
        if (!this.parser || !message.taskId) break;
        const completeTarget = await this.parser.getTask(message.taskId);
        if (completeTarget && isReadOnlyTask(completeTarget)) {
          vscode.window.showErrorMessage(
            `Cannot complete task: ${completeTarget.id} is read-only from ${getReadOnlyTaskContext(completeTarget)}.`
          );
          break;
        }
        const completeConfirmation = await vscode.window.showWarningMessage(
          `Move task "${completeTarget?.title}" to completed?`,
          { modal: true },
          'Complete'
        );

        if (completeConfirmation === 'Complete') {
          try {
            const writer = new BacklogWriter();
            await writer.completeTask(message.taskId, this.parser);
            await this.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to complete: ${error}`);
          }
        }
        break;
      }

      case 'promoteDraft': {
        if (!this.parser || !message.taskId) break;
        const draft = await this.parser.getTask(message.taskId);
        if (draft && isReadOnlyTask(draft)) {
          vscode.window.showErrorMessage(
            `Cannot promote draft: ${draft.id} is read-only from ${getReadOnlyTaskContext(draft)}.`
          );
          break;
        }
        try {
          const writer = new BacklogWriter();
          await writer.promoteDraft(message.taskId, this.parser);
          await this.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to promote draft: ${error}`);
        }
        break;
      }

      case 'restoreTask': {
        if (!this.parser || !message.taskId) break;
        const task = await this.parser.getTask(message.taskId);
        if (task && isReadOnlyTask(task)) {
          vscode.window.showErrorMessage(
            `Cannot restore task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`
          );
          break;
        }
        try {
          const writer = new BacklogWriter();
          await writer.restoreArchivedTask(message.taskId, this.parser);
          await this.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to restore task: ${error}`);
        }
        break;
      }

      case 'deleteTask': {
        if (!this.parser || !message.taskId) break;
        const taskToDelete = await this.parser.getTask(message.taskId);
        if (taskToDelete && isReadOnlyTask(taskToDelete)) {
          vscode.window.showErrorMessage(
            `Cannot delete task: ${taskToDelete.id} is read-only from ${getReadOnlyTaskContext(taskToDelete)}.`
          );
          break;
        }
        const deleteConfirmation = await vscode.window.showWarningMessage(
          `Permanently delete task "${taskToDelete?.title}"? This cannot be undone.`,
          { modal: true },
          'Delete'
        );

        if (deleteConfirmation === 'Delete') {
          try {
            const writer = new BacklogWriter();
            await writer.deleteTask(message.taskId, this.parser);
            await this.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
          }
        }
        break;
      }

      case 'requestCompletedTasks': {
        if (!this.parser) break;
        try {
          const completedTasks = await this.parser.getCompletedTasks();
          this.postMessage({ type: 'completedTasksUpdated', tasks: completedTasks });
        } catch (error) {
          console.error('[Backlog.md] Error loading completed tasks:', error);
          this.postMessage({ type: 'error', message: 'Failed to load completed tasks' });
        }
        break;
      }

      case 'setViewMode': {
        this.setViewMode(message.mode);
        break;
      }

      case 'openDocument': {
        vscode.commands.executeCommand('backlog.openDocumentDetail', message.documentId);
        break;
      }

      case 'openDecision': {
        vscode.commands.executeCommand('backlog.openDecisionDetail', message.decisionId);
        break;
      }

      case 'filterByStatus': {
        vscode.commands.executeCommand('backlog.filterByStatus', message.status);
        break;
      }

      case 'requestCreateTask': {
        vscode.commands.executeCommand('backlog.createTask');
        break;
      }

      case 'toggleColumnCollapse': {
        const status = message.status;
        if (this.collapsedColumns.has(status)) {
          this.collapsedColumns.delete(status);
        } else {
          this.collapsedColumns.add(status);
        }
        // Persist to globalState
        if (this.context) {
          await this.context.globalState.update(
            'backlog.collapsedColumns',
            Array.from(this.collapsedColumns)
          );
        }
        // Notify webview
        this.postMessage({
          type: 'columnCollapseChanged',
          collapsedColumns: Array.from(this.collapsedColumns),
        });
        break;
      }

      case 'toggleMilestoneGrouping': {
        this.milestoneGrouping = message.enabled;
        // Persist to globalState
        if (this.context) {
          await this.context.globalState.update(
            'backlog.milestoneGrouping',
            this.milestoneGrouping
          );
        }
        // Notify webview (for consistency, though UI already updated)
        this.postMessage({
          type: 'milestoneGroupingChanged',
          enabled: this.milestoneGrouping,
        });
        break;
      }

      case 'toggleMilestoneCollapse': {
        const milestone = message.milestone;
        if (this.collapsedMilestones.has(milestone)) {
          this.collapsedMilestones.delete(milestone);
        } else {
          this.collapsedMilestones.add(milestone);
        }
        // Persist to globalState
        if (this.context) {
          await this.context.globalState.update(
            'backlog.collapsedMilestones',
            Array.from(this.collapsedMilestones)
          );
        }
        // Notify webview
        this.postMessage({
          type: 'milestoneCollapseChanged',
          collapsedMilestones: Array.from(this.collapsedMilestones),
        });
        break;
      }
    }
  }

  /**
   * Set the data source mode and notify the webview
   */
  setDataSourceMode(mode: DataSourceMode, reason?: string): void {
    this.dataSourceMode = mode;
    this.dataSourceReason = reason;
    this.postMessage({ type: 'dataSourceChanged', mode, reason });
  }

  /**
   * Get the current data source mode
   */
  getDataSourceMode(): DataSourceMode {
    return this.dataSourceMode;
  }

  /**
   * Set the view mode (kanban, list, or drafts) from external command.
   * Drafts mode is treated as a special list view showing draft tasks.
   */
  setViewMode(
    mode: 'kanban' | 'list' | 'drafts' | 'archived' | 'dashboard' | 'docs' | 'decisions'
  ): void {
    if (this.viewMode === mode) return;
    const previousMode = this.viewMode;
    this.viewMode = mode;

    const isDrafts = mode === 'drafts';
    const isArchived = mode === 'archived';
    const isDashboard = mode === 'dashboard';
    const isDocs = mode === 'docs';
    const isDecisions = mode === 'decisions';

    if (this.context) {
      this.context.globalState.update('backlog.viewMode', mode);
      this.context.globalState.update('backlog.showingDrafts', isDrafts);
    }

    // Send unified tab message
    this.postMessage({ type: 'activeTabChanged', tab: mode });
    // Backward compatibility: also send legacy messages
    this.postMessage({ type: 'draftsModeChanged', enabled: isDrafts });
    if (!isDashboard && !isDocs && !isDecisions) {
      this.postMessage({
        type: 'viewModeChanged',
        viewMode: isDrafts || isArchived ? 'list' : mode,
      });
    }

    // Refresh dashboard stats when switching to dashboard
    if (isDashboard) {
      this.refreshDashboard();
      return;
    }

    // Refresh docs/decisions when switching to those tabs
    if (isDocs) {
      this.refreshDocuments();
      return;
    }
    if (isDecisions) {
      this.refreshDecisions();
      return;
    }

    // Refresh to load correct task set when switching to/from special modes
    const specialModes = ['drafts', 'archived', 'dashboard', 'docs', 'decisions'];
    const needsRefresh = specialModes.includes(mode) || specialModes.includes(previousMode);
    if (needsRefresh) {
      this.refresh();
    }
  }

  /**
   * Set the filter in the list view from external command
   */
  setFilter(filter: string): void {
    this.postMessage({ type: 'setFilter', filter });
  }

  /**
   * Set the label filter in the list view from external command
   */
  setLabelFilter(label: string): void {
    this.postMessage({ type: 'setLabelFilter', label });
  }

  /**
   * Refresh documents list and send to webview
   */
  async refreshDocuments(): Promise<void> {
    if (!this._view || !this.parser) return;

    try {
      const documents = await this.parser.getDocuments();
      this.postMessage({ type: 'activeTabChanged', tab: 'docs' });
      this.postMessage({ type: 'documentsUpdated', documents });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing documents:', error);
      this.postMessage({ type: 'error', message: 'Failed to load documents' });
    }
  }

  /**
   * Refresh decisions list and send to webview
   */
  async refreshDecisions(): Promise<void> {
    if (!this._view || !this.parser) return;

    try {
      const decisions = await this.parser.getDecisions();
      this.postMessage({ type: 'activeTabChanged', tab: 'decisions' });
      this.postMessage({ type: 'decisionsUpdated', decisions });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing decisions:', error);
      this.postMessage({ type: 'error', message: 'Failed to load decisions' });
    }
  }

  /**
   * Refresh dashboard statistics and send to webview
   */
  async refreshDashboard(): Promise<void> {
    if (!this._view || !this.parser) return;

    try {
      const [tasks, completedTasks, statuses] = await Promise.all([
        this.parser.getTasks(),
        this.parser.getCompletedTasks(),
        this.parser.getStatuses(),
      ]);
      const stats = this.computeStatistics(tasks, completedTasks.length, statuses);
      this.postMessage({ type: 'statsUpdated', stats });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing dashboard stats:', error);
      this.postMessage({ type: 'error', message: 'Failed to load statistics' });
    }
  }

  /**
   * Compute statistics from tasks.
   * The statuses array comes from the backlog config. The last status in the list
   * is treated as the "done" status for milestone completion tracking.
   */
  private computeStatistics(
    tasks: Task[],
    completedCount: number = 0,
    statuses: string[] = ['To Do', 'In Progress', 'Done']
  ): {
    totalTasks: number;
    completedCount: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    milestones: Array<{ name: string; total: number; done: number }>;
  } {
    // Build byStatus dynamically: start with all config statuses (preserving order)
    const byStatus: Record<string, number> = {};
    for (const status of statuses) {
      byStatus[status] = 0;
    }

    const byPriority: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    // The last configured status is treated as the "done" status
    const doneStatus = statuses.length > 0 ? statuses[statuses.length - 1] : 'Done';

    const milestoneMap = new Map<string, { total: number; done: number }>();

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;

      const priority = task.priority || 'none';
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      if (task.milestone) {
        if (!milestoneMap.has(task.milestone)) {
          milestoneMap.set(task.milestone, { total: 0, done: 0 });
        }
        const m = milestoneMap.get(task.milestone)!;
        m.total++;
        if (task.status === doneStatus) {
          m.done++;
        }
      }
    }

    const milestones = Array.from(milestoneMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => {
        const aPct = a.total > 0 ? a.done / a.total : 0;
        const bPct = b.total > 0 ? b.done / b.total : 0;
        return aPct - bPct;
      });

    return {
      totalTasks: tasks.length,
      completedCount,
      byStatus,
      byPriority,
      milestones,
    };
  }
}
