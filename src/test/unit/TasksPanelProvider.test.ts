import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { createMockExtensionContext } from '../mocks/vscode';
import { TasksPanelProvider } from '../../providers/TasksPanelProvider';
import { BacklogParser } from '../../core/BacklogParser';

/**
 * Unit tests for the editor-tab host. The TasksController is exercised in
 * TasksController.test.ts; here we verify the panel lifecycle, singleton reveal,
 * and that fan-out calls (refresh / setParser / setActiveEditedTaskId) are safe
 * whether or not a panel is open.
 */
describe('TasksPanelProvider', () => {
  let extensionUri: vscode.Uri;
  let mockContext: vscode.ExtensionContext;
  let mockParser: BacklogParser;
  let mockWebview: Partial<vscode.Webview>;
  let mockPanel: Partial<vscode.WebviewPanel>;
  let messageHandler: (message: unknown) => Promise<void>;
  let disposeCallback: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    extensionUri = vscode.Uri.file('/test/extension');
    mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;

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
      dispose: vi.fn(),
      onDidDispose: vi.fn((callback: () => void) => {
        disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
    };

    (vscode.window.createWebviewPanel as Mock).mockReturnValue(mockPanel);

    mockParser = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTasksWithCrossBranch: vi.fn().mockResolvedValue([]),
      getConfig: vi.fn().mockResolvedValue({}),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getMilestones: vi.fn().mockResolvedValue([]),
      getDrafts: vi.fn().mockResolvedValue([]),
      getCompletedTasks: vi.fn().mockResolvedValue([]),
      getArchivedTasks: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a single webview panel on first reveal', () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    provider.reveal();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'backlog.tasksEditor',
      'Backlog',
      vscode.ViewColumn.Active,
      expect.objectContaining({ enableScripts: true, retainContextWhenHidden: true })
    );
    expect(provider.isOpen()).toBe(true);
  });

  it('reveals the existing panel instead of creating a second one', () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    provider.reveal();
    provider.reveal();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(mockPanel.reveal).toHaveBeenCalled();
  });

  it('renders the Tasks webview into the panel with the editor-host marker', () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    provider.reveal();
    // Editor host carries an exclusive marker so tooling can tell the two
    // identical boards apart; it also keeps the shared tasks-page class.
    expect(mockWebview.html).toContain('tasks-page tasks-editor-page');
    expect(mockWebview.html).toContain('id="app"');
  });

  it('routes webview messages to the controller (refresh re-sends data)', async () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    provider.reveal();
    (mockWebview.postMessage as Mock).mockClear();

    await messageHandler({ type: 'refresh' });

    expect(mockParser.getTasks).toHaveBeenCalled();
    const types = (mockWebview.postMessage as Mock).mock.calls.map((c) => c[0].type);
    expect(types).toContain('tasksUpdated');
  });

  it('clears state when the panel is disposed', () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    provider.reveal();
    expect(provider.isOpen()).toBe(true);

    disposeCallback();

    expect(provider.isOpen()).toBe(false);
  });

  it('fan-out calls are no-ops when the panel is closed', async () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    // No reveal() — nothing should throw or post.
    await expect(provider.refresh()).resolves.toBeUndefined();
    await expect(provider.checkAndSendIntegrationState()).resolves.toBeUndefined();
    expect(() => provider.setActiveEditedTaskId('TASK-1')).not.toThrow();
    expect(() => provider.setParser(mockParser)).not.toThrow();
    expect(provider.isOpen()).toBe(false);
  });

  it('forwards active-task highlighting to the open panel', () => {
    const provider = new TasksPanelProvider(extensionUri, mockParser, mockContext);
    provider.reveal();
    (mockWebview.postMessage as Mock).mockClear();

    provider.setActiveEditedTaskId('TASK-5');

    expect(mockWebview.postMessage).toHaveBeenCalledWith({
      type: 'activeEditedTaskChanged',
      taskId: 'TASK-5',
    });
  });
});
