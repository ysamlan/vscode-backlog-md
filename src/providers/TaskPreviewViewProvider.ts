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
import { computeSubtasks } from '../core/BacklogParser';
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

type TaskSelectionRef = {
  taskId: string;
  filePath?: string;
  source?: TaskSource;
  branch?: string;
};

type SubtaskSummary = {
  id: string;
  title: string;
  status: string;
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
    const componentStyleUri = this.getResourceUri(webview, 'task-preview.css');
    const scriptUri = this.getResourceUri(webview, 'task-preview.js');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <link href="${componentStyleUri}" rel="stylesheet">
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

    const contextTasks = await this.getContextTasks(this.selectedTaskRef);
    const taskInContext =
      this.resolveTaskFromCollection(contextTasks, this.selectedTaskRef) ?? task;
    const taskWithBlocks = this.enrichTaskWithBlocks(taskInContext, contextTasks);
    const subtaskSummaries = await this.resolveSubtaskSummaries(
      taskWithBlocks,
      this.selectedTaskRef
    );
    const statuses = await this.parser.getStatuses();
    const descriptionHtml = taskWithBlocks.description
      ? await parseMarkdown(taskWithBlocks.description)
      : '';
    const planHtml = taskWithBlocks.implementationPlan
      ? await parseMarkdown(taskWithBlocks.implementationPlan)
      : '';
    const notesHtml = taskWithBlocks.implementationNotes
      ? await parseMarkdown(taskWithBlocks.implementationNotes)
      : '';
    const finalSummaryHtml = taskWithBlocks.finalSummary
      ? await parseMarkdown(taskWithBlocks.finalSummary)
      : '';
    this.postMessage({
      type: 'taskPreviewData',
      task: taskWithBlocks,
      statuses,
      descriptionHtml,
      planHtml,
      notesHtml,
      finalSummaryHtml,
      isReadOnly: isReadOnlyTask(taskWithBlocks),
      readOnlyReason: isReadOnlyTask(taskWithBlocks)
        ? `Task is from ${getReadOnlyTaskContext(taskWithBlocks)} and is read-only.`
        : undefined,
      subtaskSummaries,
    });
  }

  protected async handleMessage(message: WebviewMessage): Promise<void> {
    if (!this.parser) return;

    switch (message.type) {
      case 'refresh':
        await this.refresh();
        return;
      case 'selectTask':
        await this.selectTask({
          taskId: message.taskId,
          filePath: message.filePath,
          source: message.source,
          branch: message.branch,
        });
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

  private async resolveSubtaskSummaries(
    task: Task,
    taskRef: TaskSelectionRef
  ): Promise<SubtaskSummary[] | undefined> {
    if (!this.parser) return undefined;

    // Preserve explicit frontmatter subtasks before computeSubtasks() derives parent links.
    const explicitSubtasksByTaskId = new Map<string, string[]>();
    const contextTasks = await this.getContextTasks(taskRef);

    for (const contextTask of contextTasks) {
      if (contextTask.subtasks && contextTask.subtasks.length > 0) {
        explicitSubtasksByTaskId.set(contextTask.id, [...contextTask.subtasks]);
      }
    }

    computeSubtasks(contextTasks);
    const contextTask = this.resolveTaskFromCollection(contextTasks, taskRef) ?? task;

    const subtaskIds = new Set<string>([
      ...(explicitSubtasksByTaskId.get(contextTask.id) ?? []),
      ...(contextTask.subtasks ?? []),
    ]);

    if (subtaskIds.size === 0) return undefined;

    const taskById = new Map(contextTasks.map((contextTask) => [contextTask.id, contextTask]));
    const summaries = Array.from(subtaskIds)
      .map((subtaskId) => taskById.get(subtaskId))
      .filter((subtask): subtask is Task => Boolean(subtask))
      .map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        status: subtask.status,
        filePath: subtask.filePath,
        source: subtask.source,
        branch: subtask.branch,
      }));

    return summaries.length > 0 ? summaries : undefined;
  }

  private resolveTaskFromCollection(tasks: Task[], taskRef: TaskSelectionRef): Task | undefined {
    if (taskRef.filePath) {
      const byPath = tasks.find(
        (task) => task.id === taskRef.taskId && task.filePath === taskRef.filePath
      );
      if (byPath) return byPath;
    }

    const bySource = tasks.find(
      (task) =>
        task.id === taskRef.taskId &&
        task.source === taskRef.source &&
        task.branch === taskRef.branch
    );
    if (bySource) return bySource;

    return tasks.find((task) => task.id === taskRef.taskId);
  }

  private async getContextTasks(taskRef: TaskSelectionRef): Promise<Task[]> {
    if (!this.parser) return [];
    if (taskRef.source === 'remote' || taskRef.source === 'local-branch') {
      return this.parser.getTasksWithCrossBranch();
    }
    return this.parser.getTasks();
  }

  private enrichTaskWithBlocks(task: Task, contextTasks: Task[]): Task {
    const blocksTaskIds = contextTasks
      .filter((candidateTask) => candidateTask.dependencies.includes(task.id))
      .map((candidateTask) => candidateTask.id);
    if (blocksTaskIds.length === 0) return task;
    return { ...task, blocksTaskIds };
  }
}
