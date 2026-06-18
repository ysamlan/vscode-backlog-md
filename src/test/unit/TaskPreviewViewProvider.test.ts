import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { TaskPreviewViewProvider } from '../../providers/TaskPreviewViewProvider';
import { BacklogParser } from '../../core/BacklogParser';
import { BacklogWriter } from '../../core/BacklogWriter';
import { createMockExtensionContext } from '../mocks/vscode';

describe('TaskPreviewViewProvider', () => {
  const extensionUri = vscode.Uri.file('/test/extension');

  let parser: BacklogParser;
  let webview: {
    html: string;
    options?: vscode.WebviewOptions;
    cspSource: string;
    asWebviewUri: ReturnType<typeof vi.fn>;
    onDidReceiveMessage: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  };
  let webviewView: {
    webview: vscode.Webview;
    show: ReturnType<typeof vi.fn>;
    onDidChangeVisibility: ReturnType<typeof vi.fn>;
    onDidDispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    parser = {
      getTask: vi.fn().mockResolvedValue({
        id: 'TASK-1',
        title: 'Test task',
        status: 'To Do',
        assignee: [],
        labels: [],
        milestone: '',
        dependencies: [],
      }),
      getTasks: vi.fn().mockResolvedValue([]),
      getTasksWithCrossBranch: vi.fn().mockResolvedValue([]),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
    } as unknown as BacklogParser;

    webview = {
      html: '',
      cspSource: 'test-csp',
      asWebviewUri: vi.fn((uri) => uri),
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      postMessage: vi.fn().mockResolvedValue(true),
    };

    webviewView = {
      webview: webview as unknown as vscode.Webview,
      show: vi.fn(),
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    };

    vi.clearAllMocks();
  });

  it('includes the task-preview css bundle in HTML', () => {
    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    const asWebviewUriCalls = webview.asWebviewUri.mock.calls.map((call) => call[0]);
    const calledPaths = asWebviewUriCalls.map((uri) => String((uri as { fsPath?: string }).fsPath));

    expect(calledPaths.some((path) => path.endsWith('/task-preview.css'))).toBe(true);
    expect(calledPaths.some((path) => path.endsWith('/task-preview.js'))).toBe(true);
  });

  it('forwards openTask messages from preview to backlog.openTaskDetail command', async () => {
    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    const handler = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    expect(typeof handler).toBe('function');

    await handler({
      type: 'openTask',
      taskId: 'TASK-2',
      filePath: '/repo/backlog/tasks/TASK-2 - Example.md',
      source: 'local',
      branch: 'main',
    });

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('backlog.openTaskDetail', {
      taskId: 'TASK-2',
      filePath: '/repo/backlog/tasks/TASK-2 - Example.md',
      source: 'local',
      branch: 'main',
    });
  });

  it('handles selectTask messages by refreshing preview selection in place', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockImplementation(async (taskId: string) => ({
      id: taskId,
      title: `Task ${taskId}`,
      status: 'To Do',
      assignee: [],
      labels: [],
      milestone: '',
      dependencies: [],
      filePath: `/repo/backlog/tasks/${taskId}.md`,
    }));

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    const handler = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    expect(typeof handler).toBe('function');

    webview.postMessage.mockClear();
    (vscode.commands.executeCommand as ReturnType<typeof vi.fn>).mockClear();

    await handler({
      type: 'selectTask',
      taskId: 'TASK-22',
      filePath: '/repo/backlog/tasks/TASK-22.md',
      source: 'local',
      branch: 'main',
    });

    expect(webviewView.show).toHaveBeenCalledWith(true);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
      'backlog.openTaskDetail',
      expect.anything()
    );
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskPreviewData',
        task: expect.objectContaining({ id: 'TASK-22' }),
      })
    );
  });

  it('shows the preview view when selecting a task and posts data', async () => {
    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();

    await provider.selectTask({ taskId: 'TASK-1' });

    expect(webviewView.show).toHaveBeenCalledWith(true);
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskPreviewData',
        task: expect.objectContaining({ id: 'TASK-1' }),
      })
    );
  });

  it('includes descriptionHtml as rendered markdown in taskPreviewData', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-5',
      title: 'Markdown task',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      description: '**bold text** and `code`',
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-5' });

    const call = webview.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === 'taskPreviewData'
    );
    expect(call).toBeDefined();
    const data = call![0] as { descriptionHtml: string };
    expect(data.descriptionHtml).toContain('<strong>bold text</strong>');
    expect(data.descriptionHtml).toContain('<code>code</code>');
  });

  it('sends empty descriptionHtml when task has no description', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-6',
      title: 'No desc',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      description: '',
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-6' });

    const call = webview.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === 'taskPreviewData'
    );
    expect(call).toBeDefined();
    expect((call![0] as { descriptionHtml: string }).descriptionHtml).toBe('');
  });

  it('includes planHtml, notesHtml, and finalSummaryHtml as rendered markdown in taskPreviewData', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-7',
      title: 'Task with body sections',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      implementationPlan: '1. First step\n2. Second step',
      implementationNotes: 'Used **approach X**.',
      finalSummary: 'All done with `code`.',
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-7' });

    const call = webview.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === 'taskPreviewData'
    );
    expect(call).toBeDefined();
    const data = call![0] as { planHtml: string; notesHtml: string; finalSummaryHtml: string };
    expect(data.planHtml).toContain('First step');
    expect(data.notesHtml).toContain('<strong>approach X</strong>');
    expect(data.finalSummaryHtml).toContain('<code>code</code>');
  });

  it('sends empty strings for planHtml, notesHtml, finalSummaryHtml when task has no body sections', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-8',
      title: 'No body sections',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-8' });

    const call = webview.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === 'taskPreviewData'
    );
    expect(call).toBeDefined();
    const data = call![0] as { planHtml: string; notesHtml: string; finalSummaryHtml: string };
    expect(data.planHtml).toBe('');
    expect(data.notesHtml).toBe('');
    expect(data.finalSummaryHtml).toBe('');
  });

  it('includes merged subtask summaries from explicit subtasks and parent_task_id children', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-2',
      title: 'Parent',
      status: 'In Progress',
      assignee: [],
      labels: [],
      dependencies: [],
      subtasks: ['TASK-2.1'],
      filePath: '/repo/backlog/tasks/task-2.md',
    });
    (parser.getTasks as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'TASK-2',
        title: 'Parent',
        status: 'In Progress',
        assignee: [],
        labels: [],
        dependencies: [],
        subtasks: ['TASK-2.1'],
        filePath: '/repo/backlog/tasks/task-2.md',
      },
      {
        id: 'TASK-2.1',
        title: 'Child explicit',
        status: 'Done',
        assignee: [],
        labels: [],
        dependencies: [],
        parentTaskId: 'TASK-2',
        filePath: '/repo/backlog/tasks/task-2.1.md',
      },
      {
        id: 'TASK-2.2',
        title: 'Child derived',
        status: 'To Do',
        assignee: [],
        labels: [],
        dependencies: [],
        parentTaskId: 'TASK-2',
        filePath: '/repo/backlog/tasks/task-2.2.md',
      },
    ]);

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-2', filePath: '/repo/backlog/tasks/task-2.md' });

    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskPreviewData',
        subtaskSummaries: expect.arrayContaining([
          expect.objectContaining({ id: 'TASK-2.1', title: 'Child explicit' }),
          expect.objectContaining({ id: 'TASK-2.2', title: 'Child derived' }),
        ]),
      })
    );
  });

  it('includes acceptanceCriteria and definitionOfDone in the preview task payload', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-9',
      title: 'Task with checklists',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      acceptanceCriteria: [
        { id: 1, text: 'First criterion', checked: false },
        { id: 2, text: 'Second criterion', checked: true },
      ],
      definitionOfDone: [{ id: 1, text: 'Tests pass', checked: false }],
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-9' });

    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskPreviewData',
        task: expect.objectContaining({
          acceptanceCriteria: expect.arrayContaining([
            expect.objectContaining({ id: 2, text: 'Second criterion', checked: true }),
          ]),
          definitionOfDone: expect.arrayContaining([
            expect.objectContaining({ id: 1, text: 'Tests pass', checked: false }),
          ]),
        }),
      })
    );
  });

  it('persists a checklist toggle via the writer and refreshes the preview', async () => {
    const toggleSpy = vi
      .spyOn(BacklogWriter.prototype, 'toggleChecklistItem')
      .mockResolvedValue(undefined);
    const onTaskUpdated = vi.fn();

    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-1',
      title: 'Test task',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      filePath: '/repo/backlog/tasks/task-1.md',
      acceptanceCriteria: [{ id: 1, text: 'First criterion', checked: false }],
      definitionOfDone: [],
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext,
      onTaskUpdated
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    await provider.selectTask({ taskId: 'TASK-1' });

    const handler = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    expect(typeof handler).toBe('function');
    webview.postMessage.mockClear();

    await handler({
      type: 'toggleChecklistItem',
      taskId: 'TASK-1',
      listType: 'acceptanceCriteria',
      itemId: 1,
    });

    expect(toggleSpy).toHaveBeenCalledWith('TASK-1', 'acceptanceCriteria', 1, parser);
    expect(onTaskUpdated).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskPreviewData',
        task: expect.objectContaining({ id: 'TASK-1' }),
      })
    );

    toggleSpy.mockRestore();
  });

  it('toggles the task carried in the message, not the currently selected task', async () => {
    const toggleSpy = vi
      .spyOn(BacklogWriter.prototype, 'toggleChecklistItem')
      .mockResolvedValue(undefined);

    (parser.getTask as ReturnType<typeof vi.fn>).mockImplementation(async (taskId: string) => ({
      id: taskId,
      title: `Task ${taskId}`,
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      filePath: `/repo/backlog/tasks/${taskId}.md`,
      acceptanceCriteria: [{ id: 1, text: 'First criterion', checked: false }],
      definitionOfDone: [],
    }));

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    // The panel last selected TASK-B, but the user clicked a checkbox on TASK-A
    // (still rendered) before the refresh landed.
    await provider.selectTask({ taskId: 'TASK-B' });

    const handler = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    await handler({
      type: 'toggleChecklistItem',
      taskId: 'TASK-A',
      listType: 'acceptanceCriteria',
      itemId: 1,
    });

    expect(toggleSpy).toHaveBeenCalledWith('TASK-A', 'acceptanceCriteria', 1, parser);
    expect(toggleSpy).not.toHaveBeenCalledWith('TASK-B', 'acceptanceCriteria', 1, parser);

    toggleSpy.mockRestore();
  });

  it('does not toggle checklist items for read-only cross-branch tasks', async () => {
    const toggleSpy = vi
      .spyOn(BacklogWriter.prototype, 'toggleChecklistItem')
      .mockResolvedValue(undefined);

    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-REMOTE-1',
      title: 'Cross branch task',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      source: 'local-branch',
      branch: 'feature/other-work',
      filePath: '/repo/.backlog/branches/feature/backlog/tasks/task-remote-1.md',
      acceptanceCriteria: [{ id: 1, text: 'First criterion', checked: false }],
      definitionOfDone: [],
    });

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    await provider.selectTask({ taskId: 'TASK-REMOTE-1' });

    const handler = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    await handler({
      type: 'toggleChecklistItem',
      taskId: 'TASK-REMOTE-1',
      listType: 'acceptanceCriteria',
      itemId: 1,
    });

    expect(toggleSpy).not.toHaveBeenCalled();

    toggleSpy.mockRestore();
  });

  it('includes reverse dependency blocksTaskIds in preview task payload', async () => {
    (parser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-1',
      title: 'Root',
      status: 'To Do',
      assignee: [],
      labels: [],
      dependencies: [],
      filePath: '/repo/backlog/tasks/task-1.md',
    });
    (parser.getTasks as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'TASK-1',
        title: 'Root',
        status: 'To Do',
        assignee: [],
        labels: [],
        dependencies: [],
        filePath: '/repo/backlog/tasks/task-1.md',
      },
      {
        id: 'TASK-2',
        title: 'Blocked child',
        status: 'In Progress',
        assignee: [],
        labels: [],
        dependencies: ['TASK-1'],
        filePath: '/repo/backlog/tasks/task-2.md',
      },
    ]);

    const provider = new TaskPreviewViewProvider(
      extensionUri,
      parser,
      createMockExtensionContext() as unknown as vscode.ExtensionContext
    );

    provider.resolveWebviewView(
      webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );

    webview.postMessage.mockClear();
    await provider.selectTask({ taskId: 'TASK-1', filePath: '/repo/backlog/tasks/task-1.md' });

    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskPreviewData',
        task: expect.objectContaining({
          id: 'TASK-1',
          blocksTaskIds: ['TASK-2'],
        }),
      })
    );
  });
});
