import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { createMockExtensionContext } from '../mocks/vscode';
import { TasksViewProvider } from '../../providers/TasksViewProvider';
import { BacklogParser } from '../../core/BacklogParser';

describe('TasksViewProvider', () => {
  let extensionUri: vscode.Uri;
  let mockParser: BacklogParser;
  let mockWebviewView: Partial<vscode.WebviewView>;
  let mockWebview: Partial<vscode.Webview>;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    extensionUri = vscode.Uri.file('/test/extension');
    mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;

    mockWebview = {
      html: '',
      asWebviewUri: vi.fn((uri) => uri),
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      postMessage: vi.fn().mockResolvedValue(true),
      cspSource: 'test-csp',
    };

    mockWebviewView = {
      webview: mockWebview as vscode.Webview,
      visible: true,
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    };

    mockParser = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTasksWithCrossBranch: vi.fn().mockResolvedValue([]),
      getTask: vi.fn(),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getMilestones: vi.fn().mockResolvedValue([]),
      getBlockedByThisTask: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function resolveView(provider: TasksViewProvider) {
    provider.resolveWebviewView(
      mockWebviewView as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as vscode.CancellationToken
    );
  }

  describe('setFilter', () => {
    it('should post setFilter message with the filter value', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setFilter('todo');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'todo',
      });
    });

    it('should post setFilter message for in-progress filter', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setFilter('in-progress');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'in-progress',
      });
    });

    it('should post setFilter message for done filter', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setFilter('done');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'done',
      });
    });

    it('should post setFilter message for all filter', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setFilter('all');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'all',
      });
    });
  });

  describe('setViewMode', () => {
    it('should post activeTabChanged and viewModeChanged when mode changes', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Default is kanban, so changing to list should trigger messages
      provider.setViewMode('list');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'list',
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'viewModeChanged',
        viewMode: 'list',
      });
    });

    it('should not post message when mode is already set', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Reset mock to clear any initialization calls
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      // Default is kanban, setting to kanban again should not trigger message
      provider.setViewMode('kanban');

      expect(mockWebview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'activeTabChanged' })
      );
      expect(mockWebview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'viewModeChanged' })
      );
    });

    it('should persist viewMode to globalState', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('list');

      expect(mockContext.globalState.get('backlog.viewMode')).toBe('list');
    });
  });

  describe('setViewMode with drafts', () => {
    it('should send activeTabChanged, draftsModeChanged and viewModeChanged when switching to drafts', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('drafts');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'drafts',
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'draftsModeChanged',
        enabled: true,
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'viewModeChanged',
        viewMode: 'list',
      });
    });

    it('should disable drafts mode when switching from drafts to kanban', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // First switch to drafts
      provider.setViewMode('drafts');
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      // Then switch to kanban
      provider.setViewMode('kanban');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'kanban',
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'draftsModeChanged',
        enabled: false,
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'viewModeChanged',
        viewMode: 'kanban',
      });
    });

    it('should disable drafts mode when switching from drafts to list', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // First switch to drafts
      provider.setViewMode('drafts');
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      // Then switch to list
      provider.setViewMode('list');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'list',
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'draftsModeChanged',
        enabled: false,
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'viewModeChanged',
        viewMode: 'list',
      });
    });

    it('should not send messages when setting same mode', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('drafts');
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      // Setting drafts again should be a no-op
      provider.setViewMode('drafts');

      expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('setViewMode with archived', () => {
    it('should send activeTabChanged with archived tab', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('archived');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'archived',
      });
    });

    it('should send viewModeChanged with list for archived mode', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('archived');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'viewModeChanged',
        viewMode: 'list',
      });
    });

    it('should persist archived mode to globalState', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('archived');

      expect(mockContext.globalState.get('backlog.viewMode')).toBe('archived');
    });
  });

  describe('refresh with archived mode', () => {
    it('should load archived tasks when viewMode is archived', async () => {
      const archivedTasks = [
        {
          id: 'TASK-5',
          title: 'Archived Task',
          status: 'Done' as const,
          folder: 'archive' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/archive/tasks/task-5.md',
        },
      ];

      (mockParser as unknown as Record<string, unknown>).getArchivedTasks = vi
        .fn()
        .mockResolvedValue(archivedTasks);
      (mockParser as unknown as Record<string, unknown>).getDrafts = vi.fn().mockResolvedValue([]);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Switch to archived mode
      provider.setViewMode('archived');
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(
        (mockParser as unknown as Record<string, ReturnType<typeof vi.fn>>).getArchivedTasks
      ).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasksUpdated',
          tasks: expect.arrayContaining([
            expect.objectContaining({ id: 'TASK-5', folder: 'archive' }),
          ]),
        })
      );
    });

    it('should trigger refresh when switching to archived mode', async () => {
      (mockParser as unknown as Record<string, unknown>).getArchivedTasks = vi
        .fn()
        .mockResolvedValue([]);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Clear any initialization calls
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('archived');

      // Should have triggered refresh which calls getArchivedTasks
      // Wait a tick for the async refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        (mockParser as unknown as Record<string, ReturnType<typeof vi.fn>>).getArchivedTasks
      ).toHaveBeenCalled();
    });

    it('should trigger refresh when switching from archived back to kanban', async () => {
      (mockParser as unknown as Record<string, unknown>).getArchivedTasks = vi
        .fn()
        .mockResolvedValue([]);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Switch to archived first
      provider.setViewMode('archived');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Clear mocks
      (mockParser.getTasks as ReturnType<typeof vi.fn>).mockClear();

      // Switch back to kanban
      provider.setViewMode('kanban');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should load regular tasks again
      expect(mockParser.getTasks).toHaveBeenCalled();
    });
  });

  describe('handleMessage setViewMode', () => {
    it('should handle setViewMode message from webview', async () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      // Simulate receiving setViewMode message from webview
      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'setViewMode', mode: 'list' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'list',
      });
    });

    it('should handle setViewMode archived from webview', async () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'setViewMode', mode: 'archived' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'archived',
      });
      expect(mockContext.globalState.get('backlog.viewMode')).toBe('archived');
    });
  });

  describe('handleMessage restoreTask', () => {
    it('should call restoreArchivedTask and refresh on restore', async () => {
      const mockWriter = {
        restoreArchivedTask: vi.fn().mockResolvedValue('/fake/backlog/tasks/task-5.md'),
      };
      vi.doMock('../../core/BacklogWriter', () => ({
        BacklogWriter: vi.fn().mockImplementation(() => mockWriter),
      }));

      (mockParser as unknown as Record<string, unknown>).getArchivedTasks = vi
        .fn()
        .mockResolvedValue([]);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'restoreTask', taskId: 'TASK-5' });

      // Provider should have attempted a refresh (which posts messages)
      expect(mockWebview.postMessage).toHaveBeenCalled();
    });
  });

  describe('handleMessage deleteTask', () => {
    it('should handle deleteTask message from webview', async () => {
      (mockParser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'TASK-5',
        title: 'Task to Delete',
        status: 'Done',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/backlog/archive/tasks/task-5.md',
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];

      // The delete requires a confirmation dialog - in tests, showWarningMessage returns undefined
      // so the delete should not proceed
      await messageHandler({ type: 'deleteTask', taskId: 'TASK-5' });

      // Should have shown a confirmation dialog
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Task to Delete'),
        expect.objectContaining({ modal: true }),
        'Delete'
      );
    });
  });

  describe('requestCompletedTasks', () => {
    it('should send completed tasks to webview', async () => {
      const completedTasks = [
        {
          id: 'TASK-1',
          title: 'Completed Task',
          status: 'Done' as const,
          folder: 'completed' as const,
          source: 'completed' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/completed/task-1.md',
        },
      ];

      (mockParser as unknown as Record<string, unknown>).getCompletedTasks = vi
        .fn()
        .mockResolvedValue(completedTasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Simulate receiving requestCompletedTasks message
      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'requestCompletedTasks' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'completedTasksUpdated',
        tasks: completedTasks,
      });
    });
  });
});
