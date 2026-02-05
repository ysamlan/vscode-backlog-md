import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { WebviewMessage, DataSourceMode, Task } from '../core/types';
import { BacklogWriter } from '../core/BacklogWriter';

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
  private viewMode: 'kanban' | 'list' = 'kanban';
  private milestoneGrouping: boolean = false;
  private dataSourceMode: DataSourceMode = 'local-only';
  private dataSourceReason?: string;
  private collapsedColumns: Set<string> = new Set();
  private collapsedMilestones: Set<string> = new Set();

  protected get viewType(): string {
    return 'backlog.kanban';
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    resolveContext: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    // Load saved view mode, milestone grouping, and collapsed columns from globalState
    if (this.context) {
      this.viewMode = this.context.globalState.get('backlog.viewMode', 'kanban');
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
    const scriptUri = this.getResourceUri(webview, 'tasks.js');

    // CSP allows our script and ES module imports from the same origin
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
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
      // Use cross-branch loading when in cross-branch mode
      const taskLoader =
        this.dataSourceMode === 'cross-branch'
          ? this.parser.getTasksWithCrossBranch()
          : this.parser.getTasks();

      const [tasks, statuses, milestones] = await Promise.all([
        taskLoader,
        this.parser.getStatuses(),
        this.parser.getMilestones(),
      ]);

      // Compute reverse dependencies (blocksTaskIds) for each task
      const tasksWithBlocks = await Promise.all(
        tasks.map(async (task) => ({
          ...task,
          blocksTaskIds: await this.parser!.getBlockedByThisTask(task.id),
        }))
      );

      // Send initial state along with data
      this.postMessage({ type: 'viewModeChanged', viewMode: this.viewMode });
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
        vscode.commands.executeCommand('backlog.openTaskDetail', message.taskId);
        break;
      }

      case 'updateTaskStatus': {
        if (!this.parser) break;
        const taskId = message.taskId;
        // Get original status before update for rollback
        const task = await this.parser.getTask(taskId);
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

      case 'reorderTask': {
        if (!this.parser) break;
        const taskId = message.taskId;
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
   * Set the view mode (kanban or list) from external command
   */
  setViewMode(mode: 'kanban' | 'list'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (this.context) {
      this.context.globalState.update('backlog.viewMode', mode);
    }
    this.postMessage({ type: 'viewModeChanged', viewMode: mode });
  }

  /**
   * Set the filter in the list view from external command
   */
  setFilter(filter: string): void {
    this.postMessage({ type: 'setFilter', filter });
  }
}
