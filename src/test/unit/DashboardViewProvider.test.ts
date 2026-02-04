import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { DashboardViewProvider } from '../../providers/DashboardViewProvider';
import { BacklogParser } from '../../core/BacklogParser';
import { Task } from '../../core/types';

describe('DashboardViewProvider', () => {
  let extensionUri: vscode.Uri;
  let mockParser: BacklogParser;
  let mockWebviewView: Partial<vscode.WebviewView>;
  let mockWebview: Partial<vscode.Webview>;
  let messageHandler: ((message: unknown) => void) | undefined;

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

    mockWebviewView = {
      webview: mockWebview as vscode.Webview,
      visible: true,
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    };

    mockParser = {
      getTasks: vi.fn(),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getMilestones: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;
  });

  afterEach(() => {
    vi.clearAllMocks();
    messageHandler = undefined;
  });

  describe('handleMessage', () => {
    it('should execute backlog.filterByStatus command when filterByStatus message is received', async () => {
      const provider = new DashboardViewProvider(extensionUri, mockParser);

      // Resolve the webview view to setup the message handler
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      // Simulate receiving a filterByStatus message
      expect(messageHandler).toBeDefined();
      if (messageHandler) {
        await messageHandler({ type: 'filterByStatus', status: 'To Do' });
      }

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'backlog.filterByStatus',
        'To Do'
      );
    });

    it('should execute backlog.filterByStatus with In Progress status', async () => {
      const provider = new DashboardViewProvider(extensionUri, mockParser);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      if (messageHandler) {
        await messageHandler({ type: 'filterByStatus', status: 'In Progress' });
      }

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'backlog.filterByStatus',
        'In Progress'
      );
    });

    it('should execute backlog.filterByStatus with Done status', async () => {
      const provider = new DashboardViewProvider(extensionUri, mockParser);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      if (messageHandler) {
        await messageHandler({ type: 'filterByStatus', status: 'Done' });
      }

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('backlog.filterByStatus', 'Done');
    });
  });

  describe('computeStatistics', () => {
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

      const provider = new DashboardViewProvider(extensionUri, mockParser);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      // Trigger refresh
      if (messageHandler) {
        await messageHandler({ type: 'refresh' });
      }

      // Verify postMessage was called with correct stats
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

      const provider = new DashboardViewProvider(extensionUri, mockParser);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      if (messageHandler) {
        await messageHandler({ type: 'refresh' });
      }

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

      const provider = new DashboardViewProvider(extensionUri, mockParser);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      if (messageHandler) {
        await messageHandler({ type: 'refresh' });
      }

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
  });
});
