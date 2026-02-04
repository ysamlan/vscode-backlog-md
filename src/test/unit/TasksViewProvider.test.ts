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

  describe('setFilter', () => {
    it('should post setFilter message with the filter value', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);

      // Resolve the webview view to setup the internal view reference
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      provider.setFilter('todo');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'todo',
      });
    });

    it('should post setFilter message for in-progress filter', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      provider.setFilter('in-progress');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'in-progress',
      });
    });

    it('should post setFilter message for done filter', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      provider.setFilter('done');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'done',
      });
    });

    it('should post setFilter message for all filter', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      provider.setFilter('all');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setFilter',
        filter: 'all',
      });
    });
  });

  describe('setViewMode', () => {
    it('should post viewModeChanged message when mode changes', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      // Default is kanban, so changing to list should trigger message
      provider.setViewMode('list');

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'viewModeChanged',
        viewMode: 'list',
      });
    });

    it('should not post message when mode is already set', () => {
      const provider = new TasksViewProvider(extensionUri, mockParser, mockContext);

      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {
          isCancellationRequested: false,
          onCancellationRequested: vi.fn(),
        } as vscode.CancellationToken
      );

      // Reset mock to clear any initialization calls
      (mockWebview.postMessage as ReturnType<typeof vi.fn>).mockClear();

      // Default is kanban, setting to kanban again should not trigger message
      provider.setViewMode('kanban');

      expect(mockWebview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'viewModeChanged' })
      );
    });
  });
});
