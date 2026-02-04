import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { TaskCreatePanel } from '../../providers/TaskCreatePanel';
import { BacklogParser } from '../../core/BacklogParser';
import { BacklogWriter } from '../../core/BacklogWriter';
import { TaskDetailProvider } from '../../providers/TaskDetailProvider';

// Mock vscode module
vi.mock('vscode', () => ({
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
      fsPath: [base.fsPath, ...segments].join('/'),
    }),
  },
  window: {
    createWebviewPanel: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  ViewColumn: {
    One: 1,
  },
}));

describe('TaskCreatePanel', () => {
  let extensionUri: vscode.Uri;
  let mockParser: BacklogParser;
  let mockWriter: BacklogWriter;
  let mockPanel: Partial<vscode.WebviewPanel>;
  let mockWebview: Partial<vscode.Webview>;
  let mockTaskDetailProvider: TaskDetailProvider;
  let mockKanbanProvider: { refresh: Mock };
  let mockTaskListProvider: { refresh: Mock };
  let messageHandler: (message: unknown) => Promise<void>;

  beforeEach(() => {
    extensionUri = vscode.Uri.file('/test/extension');

    mockWebview = {
      html: '',
      asWebviewUri: vi.fn((uri) => uri),
      onDidReceiveMessage: vi.fn((handler) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }),
      postMessage: vi.fn().mockResolvedValue(true),
      cspSource: 'test-csp',
    };

    mockPanel = {
      webview: mockWebview as vscode.Webview,
      reveal: vi.fn(),
      title: '',
      dispose: vi.fn(),
      onDidDispose: vi.fn((callback: () => void) => {
        (mockPanel as { _disposeCallback?: () => void })._disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
    };

    (vscode.window.createWebviewPanel as Mock).mockReturnValue(mockPanel);

    mockParser = {
      getTask: vi.fn(),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getUniqueLabels: vi.fn().mockResolvedValue([]),
      getUniqueAssignees: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;

    mockWriter = {
      createTask: vi.fn().mockResolvedValue({ id: 'TASK-1', filePath: '/test/tasks/task-1.md' }),
    } as unknown as BacklogWriter;

    mockTaskDetailProvider = {
      openTask: vi.fn(),
    } as unknown as TaskDetailProvider;

    mockKanbanProvider = { refresh: vi.fn() };
    mockTaskListProvider = { refresh: vi.fn() };

    // Clear static state between tests
    TaskCreatePanel['currentPanel'] = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('show', () => {
    it('should create a new webview panel', () => {
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'backlog.createTask',
        'Create New Task',
        vscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: false,
        })
      );
    });

    it('should reveal existing panel if already open', () => {
      // First call creates panel
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );

      // Second call should reveal, not create
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    it('should include form elements in webview content', () => {
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );

      const html = mockWebview.html as string;
      expect(html).toContain('id="titleInput"');
      expect(html).toContain('id="descriptionTextarea"');
      expect(html).toContain('id="createBtn"');
      expect(html).toContain('id="cancelBtn"');
      expect(html).toContain('Create New Task');
    });

    it('should mark title as required in the form', () => {
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );

      const html = mockWebview.html as string;
      expect(html).toContain('Title');
      expect(html).toMatch(/required/i);
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );
    });

    it('should create task with correct defaults when createTask message received', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'Test Task Title',
        description: 'Test description',
      });

      expect(mockWriter.createTask).toHaveBeenCalledWith(
        '/test/backlog',
        {
          title: 'Test Task Title',
          description: 'Test description',
          status: 'To Do',
          priority: 'medium',
        },
        mockParser
      );
    });

    it('should use default values - status is "To Do", priority is "medium"', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'Minimal Task',
        description: '',
      });

      expect(mockWriter.createTask).toHaveBeenCalledWith(
        '/test/backlog',
        expect.objectContaining({
          status: 'To Do',
          priority: 'medium',
        }),
        mockParser
      );
    });

    it('should dispose panel and open task detail on successful creation', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(mockTaskDetailProvider.openTask).toHaveBeenCalledWith('TASK-1');
    });

    it('should refresh kanban and task list views on successful creation', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockKanbanProvider.refresh).toHaveBeenCalled();
      expect(mockTaskListProvider.refresh).toHaveBeenCalled();
    });

    it('should show success message on creation', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('TASK-1')
      );
    });

    it('should send error message to webview on creation failure', async () => {
      (mockWriter.createTask as Mock).mockRejectedValue(new Error('Write failed'));

      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'error',
        message: expect.stringContaining('Write failed'),
      });
    });

    it('should not dispose panel on creation failure', async () => {
      (mockWriter.createTask as Mock).mockRejectedValue(new Error('Write failed'));

      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockPanel.dispose).not.toHaveBeenCalled();
    });

    it('should dispose panel on cancel message', async () => {
      await messageHandler({ type: 'cancel' });

      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    it('should send validation error when title is empty', async () => {
      await messageHandler({
        type: 'createTask',
        title: '',
        description: 'Description',
      });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'validationError',
        field: 'title',
        message: 'Title is required',
      });
      expect(mockWriter.createTask).not.toHaveBeenCalled();
    });

    it('should send validation error when title is only whitespace', async () => {
      await messageHandler({
        type: 'createTask',
        title: '   ',
        description: 'Description',
      });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'validationError',
        field: 'title',
        message: 'Title is required',
      });
      expect(mockWriter.createTask).not.toHaveBeenCalled();
    });
  });

  describe('panel disposal', () => {
    it('should clear currentPanel on dispose', () => {
      TaskCreatePanel.show(
        extensionUri,
        mockWriter,
        mockParser,
        '/test/backlog',
        {
          kanbanProvider: mockKanbanProvider,
          taskListProvider: mockTaskListProvider,
          taskDetailProvider: mockTaskDetailProvider,
        }
      );

      expect(TaskCreatePanel['currentPanel']).toBeDefined();

      // Simulate panel disposal
      const disposeCallback = (mockPanel as { _disposeCallback?: () => void })._disposeCallback;
      if (disposeCallback) {
        disposeCallback();
      }

      expect(TaskCreatePanel['currentPanel']).toBeUndefined();
    });
  });
});
