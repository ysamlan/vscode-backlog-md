import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { BacklogParser } from '../core/BacklogParser';
import {
  WebviewMessage,
  Task,
  TaskSource,
  isReadOnlyTask,
  getReadOnlyTaskContext,
} from '../core/types';
import { BacklogWriter } from '../core/BacklogWriter';

type TaskSelectionRef = {
  taskId: string;
  filePath?: string;
  source?: TaskSource;
  branch?: string;
};

export class TaskPreviewViewProvider extends BaseViewProvider {
  private selectedTaskRef: TaskSelectionRef | null = null;

  constructor(
    extensionUri: vscode.Uri,
    parser: BacklogParser | undefined,
    context?: vscode.ExtensionContext,
    private readonly onTaskUpdated?: () => void
  ) {
    super(extensionUri, parser, context);
  }

  protected get viewType(): string {
    return 'backlog.taskPreview';
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const styleUri = this.getResourceUri(webview, 'styles.css');
    const scriptUri = this.getResourceUri(webview, 'task-preview.js');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>Task Preview</title>
</head>
<body class="task-preview-page">
    <div id="app"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public async selectTask(taskRef: TaskSelectionRef): Promise<void> {
    this.selectedTaskRef = taskRef;
    if (this._view) {
      this._view.show(true);
    } else {
      await vscode.commands.executeCommand('backlog.taskPreview.focus');
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this._view) return;

    if (!this.parser || !this.selectedTaskRef) {
      this.postMessage({ type: 'taskPreviewCleared' });
      return;
    }

    const task = await this.resolveTask(this.selectedTaskRef);
    if (!task) {
      this.postMessage({ type: 'taskPreviewCleared' });
      return;
    }

    const statuses = await this.parser.getStatuses();
    this.postMessage({
      type: 'taskPreviewData',
      task,
      statuses,
      isReadOnly: isReadOnlyTask(task),
      readOnlyReason: isReadOnlyTask(task)
        ? `Task is from ${getReadOnlyTaskContext(task)} and is read-only.`
        : undefined,
    });
  }

  protected async handleMessage(message: WebviewMessage): Promise<void> {
    if (!this.parser) return;

    switch (message.type) {
      case 'refresh':
        await this.refresh();
        return;
      case 'openTask':
        await vscode.commands.executeCommand('backlog.openTaskDetail', {
          taskId: message.taskId,
          filePath: message.filePath,
          source: message.source,
          branch: message.branch,
        });
        return;
      case 'updateTask': {
        const task = await this.parser.getTask(message.taskId);
        if (!task) return;

        if (isReadOnlyTask(task)) {
          vscode.window.showErrorMessage(
            `Cannot update task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`
          );
          return;
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
        if (Object.keys(updates).length === 0) return;

        const writer = new BacklogWriter();
        await writer.updateTask(message.taskId, updates, this.parser);
        this.onTaskUpdated?.();
        await this.refresh();
        return;
      }
    }
  }

  private async resolveTask(taskRef: TaskSelectionRef): Promise<Task | undefined> {
    if (!this.parser) return undefined;

    const localTask = await this.parser.getTask(taskRef.taskId);
    const hasExtendedIdentity = Boolean(taskRef.filePath || taskRef.source || taskRef.branch);
    if (!hasExtendedIdentity) return localTask;

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
}
