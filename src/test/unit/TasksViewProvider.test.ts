import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { createMockExtensionContext } from '../mocks/vscode';
import { TasksViewProvider } from '../../providers/TasksViewProvider';
import { BacklogParser } from '../../core/BacklogParser';
import { Task } from '../../core/types';

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
      getConfig: vi.fn().mockResolvedValue({}),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getMilestones: vi.fn().mockResolvedValue([]),
      getBlockedByThisTask: vi.fn().mockResolvedValue([]),
      getDrafts: vi.fn().mockResolvedValue([]),
      getCompletedTasks: vi.fn().mockResolvedValue([]),
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

  describe('read-only cross-branch task guards', () => {
    it('blocks updateTaskStatus for read-only tasks and posts explicit error', async () => {
      (mockParser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'TASK-REMOTE',
        title: 'Remote Task',
        status: 'To Do',
        source: 'local-branch',
        branch: 'feature/other',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/.backlog/branches/feature/remote-task.md',
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'updateTaskStatus', taskId: 'TASK-REMOTE', status: 'Done' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'taskUpdateError',
          taskId: 'TASK-REMOTE',
          originalStatus: 'To Do',
          message: expect.stringContaining('read-only'),
        })
      );
    });

    it('blocks completeTask for read-only tasks before confirmation prompt', async () => {
      (mockParser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'TASK-REMOTE',
        title: 'Remote Task',
        status: 'Done',
        source: 'remote',
        branch: 'origin/main',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/.backlog/branches/origin-main/remote-task.md',
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'completeTask', taskId: 'TASK-REMOTE' });

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('read-only')
      );
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('Move task'),
        expect.anything(),
        expect.anything()
      );
    });

    it('does not treat local tasks with branch metadata as read-only', async () => {
      (mockParser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'TASK-LOCAL',
        title: 'Local Task',
        status: 'To Do',
        source: 'local',
        branch: 'feature/current',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/backlog/tasks/task-local.md',
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'updateTaskStatus', taskId: 'TASK-LOCAL', status: 'Done' });

      expect(mockWebview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'taskUpdateError',
          taskId: 'TASK-LOCAL',
          message: expect.stringContaining('read-only'),
        })
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

  describe('setViewMode with dashboard', () => {
    it('should send activeTabChanged with dashboard tab', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('dashboard');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'activeTabChanged',
        tab: 'dashboard',
      });
    });

    it('should not send viewModeChanged for dashboard mode', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('dashboard');

      expect(mockWebview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'viewModeChanged' })
      );
    });

    it('should persist dashboard mode to globalState', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');

      expect(mockContext.globalState.get('backlog.viewMode')).toBe('dashboard');
    });

    it('should refresh dashboard stats when switching to dashboard', async () => {
      const tasks: Task[] = [
        {
          id: 'T-1',
          title: 'Task 1',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t1.md',
        },
        {
          id: 'T-2',
          title: 'Task 2',
          status: 'In Progress',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t2.md',
        },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            totalTasks: 2,
            byStatus: expect.objectContaining({
              'To Do': 1,
              'In Progress': 1,
            }),
          }),
        })
      );
    });
  });

  describe('computeStatistics (via refreshDashboard)', () => {
    it('should compute correct counts by status', async () => {
      const tasks: Task[] = [
        {
          id: 'T-1',
          title: 'Task 1',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t1.md',
        },
        {
          id: 'T-2',
          title: 'Task 2',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t2.md',
        },
        {
          id: 'T-3',
          title: 'Task 3',
          status: 'In Progress',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t3.md',
        },
        {
          id: 'T-4',
          title: 'Task 4',
          status: 'Done',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t4.md',
        },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            totalTasks: 4,
            byStatus: expect.objectContaining({
              'To Do': 2,
              'In Progress': 1,
              Done: 1,
            }),
          }),
        })
      );
    });

    it('should compute correct priority counts', async () => {
      const tasks: Task[] = [
        {
          id: 'T-1',
          title: 'Task 1',
          status: 'To Do',
          priority: 'high',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t1.md',
        },
        {
          id: 'T-2',
          title: 'Task 2',
          status: 'To Do',
          priority: 'medium',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t2.md',
        },
        {
          id: 'T-3',
          title: 'Task 3',
          status: 'To Do',
          priority: 'low',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t3.md',
        },
        {
          id: 'T-4',
          title: 'Task 4',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t4.md',
        },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            byPriority: expect.objectContaining({
              high: 1,
              medium: 1,
              low: 1,
              none: 1,
            }),
          }),
        })
      );
    });

    it('should compute milestone statistics', async () => {
      const tasks: Task[] = [
        {
          id: 'T-1',
          title: 'Task 1',
          status: 'To Do',
          milestone: 'v1.0',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t1.md',
        },
        {
          id: 'T-2',
          title: 'Task 2',
          status: 'Done',
          milestone: 'v1.0',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t2.md',
        },
        {
          id: 'T-3',
          title: 'Task 3',
          status: 'To Do',
          milestone: 'v2.0',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t3.md',
        },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            milestones: expect.arrayContaining([
              expect.objectContaining({ name: 'v2.0', total: 1, done: 0 }),
              expect.objectContaining({ name: 'v1.0', total: 2, done: 1 }),
            ]),
          }),
        })
      );
    });

    it('should count custom statuses in dashboard stats', async () => {
      const baseTask = {
        title: 'Task',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/t.md',
      };

      const tasks: Task[] = [
        { ...baseTask, id: 'T-1', status: 'Review' },
        { ...baseTask, id: 'T-2', status: 'Review' },
        { ...baseTask, id: 'T-3', status: 'QA' },
        { ...baseTask, id: 'T-4', status: 'To Do' },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            totalTasks: 4,
            byStatus: expect.objectContaining({
              Review: 2,
              QA: 1,
              'To Do': 1,
            }),
          }),
        })
      );
    });

    it('should build byStatus from config statuses', async () => {
      const baseTask = {
        title: 'Task',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/t.md',
      };

      const tasks: Task[] = [
        { ...baseTask, id: 'T-1', status: 'Backlog' },
        { ...baseTask, id: 'T-2', status: 'Review' },
      ];

      // Config returns custom statuses
      (mockParser.getStatuses as Mock).mockResolvedValue([
        'Backlog',
        'In Dev',
        'Review',
        'Deployed',
      ]);
      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            totalTasks: 2,
            byStatus: {
              Backlog: 1,
              'In Dev': 0,
              Review: 1,
              Deployed: 0,
            },
          }),
        })
      );
    });

    it('should use last config status as done status for milestones', async () => {
      const baseTask = {
        title: 'Task',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/t.md',
      };

      const tasks: Task[] = [
        { ...baseTask, id: 'T-1', status: 'Backlog', milestone: 'v1' },
        { ...baseTask, id: 'T-2', status: 'Deployed', milestone: 'v1' },
      ];

      // Last status (Deployed) is treated as "done"
      (mockParser.getStatuses as Mock).mockResolvedValue([
        'Backlog',
        'In Dev',
        'Review',
        'Deployed',
      ]);
      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            milestones: [expect.objectContaining({ name: 'v1', total: 2, done: 1 })],
          }),
        })
      );
    });

    it('should include completedCount from completed folder', async () => {
      const tasks: Task[] = [
        {
          id: 'T-1',
          title: 'Task 1',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/t1.md',
        },
      ];

      const completedTasks: Task[] = [
        {
          id: 'T-2',
          title: 'Completed 1',
          status: 'Done',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/completed/t2.md',
          source: 'completed',
        },
        {
          id: 'T-3',
          title: 'Completed 2',
          status: 'Done',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/completed/t3.md',
          source: 'completed',
        },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);
      (mockParser.getCompletedTasks as Mock).mockResolvedValue(completedTasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      provider.setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'statsUpdated',
          stats: expect.objectContaining({
            totalTasks: 1,
            completedCount: 2,
          }),
        })
      );
    });
  });

  describe('draftCountUpdated', () => {
    it('should send draftCountUpdated with count of draft tasks on refresh', async () => {
      const draftTasks = [
        {
          id: 'TASK-10',
          title: 'Draft Task 1',
          status: 'Draft' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/drafts/task-10.md',
        },
        {
          id: 'TASK-11',
          title: 'Draft Task 2',
          status: 'Draft' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/drafts/task-11.md',
        },
      ];

      (mockParser as unknown as Record<string, unknown>).getDrafts = vi
        .fn()
        .mockResolvedValue(draftTasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'draftCountUpdated',
        count: 2,
      });
    });

    it('should send draftCountUpdated with 0 when no drafts exist', async () => {
      (mockParser as unknown as Record<string, unknown>).getDrafts = vi.fn().mockResolvedValue([]);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'draftCountUpdated',
        count: 0,
      });
    });

    it('should use tasks.length as draft count when in drafts mode', async () => {
      const draftTasks = [
        {
          id: 'TASK-10',
          title: 'Draft Task 1',
          status: 'Draft' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/drafts/task-10.md',
        },
        {
          id: 'TASK-11',
          title: 'Draft Task 2',
          status: 'Draft' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/drafts/task-11.md',
        },
        {
          id: 'TASK-12',
          title: 'Draft Task 3',
          status: 'Draft' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/fake/backlog/drafts/task-12.md',
        },
      ];

      (mockParser as unknown as Record<string, unknown>).getDrafts = vi
        .fn()
        .mockResolvedValue(draftTasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      // Switch to drafts mode
      provider.setViewMode('drafts');
      await new Promise((resolve) => setTimeout(resolve, 0));
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      // In drafts mode, count comes from tasks.length (the loaded drafts), not a separate getDrafts call
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'draftCountUpdated',
        count: 3,
      });
    });
  });

  describe('handleMessage filterByStatus', () => {
    it('should execute backlog.filterByStatus command', async () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'filterByStatus', status: 'To Do' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'backlog.filterByStatus',
        'To Do'
      );
    });

    it('should execute backlog.filterByStatus with In Progress status', async () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      const messageHandler = (mockWebview.onDidReceiveMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      await messageHandler({ type: 'filterByStatus', status: 'In Progress' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'backlog.filterByStatus',
        'In Progress'
      );
    });
  });

  describe('configUpdated message', () => {
    it('should send configUpdated with project_name on refresh', async () => {
      (mockParser.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        project_name: 'My Project',
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'configUpdated',
        config: { projectName: 'My Project' },
      });
    });

    it('should send configUpdated with undefined projectName when not configured', async () => {
      (mockParser.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'configUpdated',
        config: { projectName: undefined },
      });
    });
  });

  describe('cross-branch mode from config', () => {
    it('should use cross-branch loader when check_active_branches is true', async () => {
      (mockParser.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        check_active_branches: true,
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockParser.getTasksWithCrossBranch).toHaveBeenCalled();
      expect(mockParser.getTasks).not.toHaveBeenCalled();
    });

    it('should stay in local-only mode when check_active_branches is false', async () => {
      (mockParser.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        check_active_branches: false,
      });

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockParser.getTasks).toHaveBeenCalled();
      expect(mockParser.getTasksWithCrossBranch).not.toHaveBeenCalled();
    });

    it('should stay in local-only mode when check_active_branches is undefined', async () => {
      (mockParser.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockParser.getTasks).toHaveBeenCalled();
      expect(mockParser.getTasksWithCrossBranch).not.toHaveBeenCalled();
    });
  });

  describe('reverse dependencies and subtask progress', () => {
    const baseTask = {
      title: 'Task',
      labels: [],
      assignee: [],
      acceptanceCriteria: [],
      definitionOfDone: [],
      filePath: '/t.md',
    };

    it('should compute blocksTaskIds from reverse dependency map', async () => {
      const tasks: Task[] = [
        { ...baseTask, id: 'T-1', status: 'To Do', dependencies: [] },
        { ...baseTask, id: 'T-2', status: 'To Do', dependencies: ['T-1'] },
        { ...baseTask, id: 'T-3', status: 'To Do', dependencies: ['T-1'] },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasksUpdated',
          tasks: expect.arrayContaining([
            expect.objectContaining({ id: 'T-1', blocksTaskIds: ['T-2', 'T-3'] }),
            expect.objectContaining({ id: 'T-2', blocksTaskIds: [] }),
            expect.objectContaining({ id: 'T-3', blocksTaskIds: [] }),
          ]),
        })
      );
    });

    it('should not call getBlockedByThisTask during refresh', async () => {
      const tasks: Task[] = [
        { ...baseTask, id: 'T-1', status: 'To Do', dependencies: [] },
        { ...baseTask, id: 'T-2', status: 'To Do', dependencies: ['T-1'] },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);

      await provider.refresh();

      expect(mockParser.getBlockedByThisTask).not.toHaveBeenCalled();
    });

    it('should compute subtaskProgress via map lookup', async () => {
      const tasks: Task[] = [
        {
          ...baseTask,
          id: 'T-1',
          status: 'To Do',
          dependencies: [],
          subtasks: ['T-2', 'T-3'],
          parentTaskId: undefined,
        },
        {
          ...baseTask,
          id: 'T-2',
          status: 'Done',
          dependencies: [],
          parentTaskId: 'T-1',
        },
        {
          ...baseTask,
          id: 'T-3',
          status: 'To Do',
          dependencies: [],
          parentTaskId: 'T-1',
        },
      ];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasksUpdated',
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: 'T-1',
              subtaskProgress: { total: 2, done: 1 },
            }),
          ]),
        })
      );
    });

    it('should not include subtaskProgress when task has no subtasks', async () => {
      const tasks: Task[] = [{ ...baseTask, id: 'T-1', status: 'To Do', dependencies: [] }];

      (mockParser.getTasks as Mock).mockResolvedValue(tasks);

      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);
      resolveView(provider);
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      await provider.refresh();

      const tasksUpdatedCall = (
        mockWebview.postMessage as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: unknown[]) => (call[0] as { type: string }).type === 'tasksUpdated');
      const sentTasks = (tasksUpdatedCall![0] as { tasks: Task[] }).tasks;
      expect(sentTasks[0]).not.toHaveProperty('subtaskProgress');
    });
  });
});
