import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { TaskDetailProvider } from '../../providers/TaskDetailProvider';
import { BacklogParser } from '../../core/BacklogParser';

// vscode mock is provided via vitest.config.ts alias

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock marked module
vi.mock('marked', () => ({
  marked: {
    setOptions: vi.fn(),
    parse: vi.fn((markdown: string) => `<p>${markdown}</p>`),
  },
}));

describe('TaskDetailProvider', () => {
  let extensionUri: vscode.Uri;
  let mockParser: BacklogParser;
  let mockPanel: Partial<vscode.WebviewPanel>;
  let mockWebview: Partial<vscode.Webview>;

  beforeEach(() => {
    extensionUri = vscode.Uri.file('/test/extension');

    mockWebview = {
      html: '',
      asWebviewUri: vi.fn((uri) => uri),
      onDidReceiveMessage: vi.fn(),
      cspSource: 'test-csp',
    };

    mockPanel = {
      webview: mockWebview as vscode.Webview,
      reveal: vi.fn(),
      title: '',
      dispose: vi.fn(),
      onDidDispose: vi.fn((callback: () => void) => {
        // Store callback for later invocation in tests
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
      getMilestones: vi.fn().mockResolvedValue([]),
      getTasks: vi.fn().mockResolvedValue([]),
      getBlockedByThisTask: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;

    // Reset fs mocks
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue('# Test Task\nContent');

    // Clear static state between tests
    TaskDetailProvider['currentPanel'] = undefined;
    TaskDetailProvider['currentTaskId'] = undefined;
    TaskDetailProvider['currentFileHash'] = undefined;
    TaskDetailProvider['currentFilePath'] = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onFileChanged', () => {
    it('should ignore events when no panel is open', () => {
      const provider = new TaskDetailProvider(extensionUri, mockParser);
      const uri = vscode.Uri.file('/test/backlog/tasks/task-1.md');

      // No panel is open - should not throw or call anything
      TaskDetailProvider.onFileChanged(uri, provider);

      expect(mockParser.getTask).not.toHaveBeenCalled();
    });

    it('should ignore events when no task ID is set', async () => {
      const provider = new TaskDetailProvider(extensionUri, mockParser);
      const uri = vscode.Uri.file('/test/backlog/tasks/task-1.md');

      // Set panel but not task ID
      TaskDetailProvider['currentPanel'] = mockPanel as vscode.WebviewPanel;
      TaskDetailProvider['currentTaskId'] = undefined;

      TaskDetailProvider.onFileChanged(uri, provider);

      expect(mockParser.getTask).not.toHaveBeenCalled();
    });

    it('should ignore events when no file path is tracked', async () => {
      const provider = new TaskDetailProvider(extensionUri, mockParser);
      const uri = vscode.Uri.file('/test/backlog/tasks/task-1.md');

      // Set panel and task ID but not file path
      TaskDetailProvider['currentPanel'] = mockPanel as vscode.WebviewPanel;
      TaskDetailProvider['currentTaskId'] = 'TASK-1';
      TaskDetailProvider['currentFilePath'] = undefined;

      TaskDetailProvider.onFileChanged(uri, provider);

      expect(mockParser.getTask).not.toHaveBeenCalled();
    });

    it('should ignore events for non-matching files', async () => {
      const provider = new TaskDetailProvider(extensionUri, mockParser);
      const uri = vscode.Uri.file('/test/backlog/tasks/task-2.md');

      // Set up state for task-1, but file change is for task-2
      TaskDetailProvider['currentPanel'] = mockPanel as vscode.WebviewPanel;
      TaskDetailProvider['currentTaskId'] = 'TASK-1';
      TaskDetailProvider['currentFilePath'] = '/test/backlog/tasks/task-1.md';

      TaskDetailProvider.onFileChanged(uri, provider);

      expect(mockParser.getTask).not.toHaveBeenCalled();
    });

    it('should refresh view when matching file changes', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';
      const uri = vscode.Uri.file(filePath);

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      // Set up state as if task-1 is currently displayed
      TaskDetailProvider['currentPanel'] = mockPanel as vscode.WebviewPanel;
      TaskDetailProvider['currentTaskId'] = 'TASK-1';
      TaskDetailProvider['currentFilePath'] = filePath;

      TaskDetailProvider.onFileChanged(uri, provider);

      // Should trigger a refresh by calling getTask
      expect(mockParser.getTask).toHaveBeenCalledWith('TASK-1');
    });

    it('should show warning and close panel when file is deleted', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';
      const uri = vscode.Uri.file(filePath);

      // File no longer exists
      (fs.existsSync as Mock).mockReturnValue(false);

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      // Set up state as if task-1 is currently displayed
      TaskDetailProvider['currentPanel'] = mockPanel as vscode.WebviewPanel;
      TaskDetailProvider['currentTaskId'] = 'TASK-1';
      TaskDetailProvider['currentFilePath'] = filePath;

      TaskDetailProvider.onFileChanged(uri, provider);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('deleted')
      );
      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });

  describe('openTask', () => {
    it('should set currentFilePath when opening a task', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');

      expect(TaskDetailProvider['currentFilePath']).toBe(filePath);
    });

    it('should clear currentFilePath when task has no file path', async () => {
      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: undefined,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');

      expect(TaskDetailProvider['currentFilePath']).toBeUndefined();
    });

    it('should clear currentFilePath on panel dispose', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');
      expect(TaskDetailProvider['currentFilePath']).toBe(filePath);

      // Simulate panel disposal
      const disposeCallback = (mockPanel as { _disposeCallback?: () => void })._disposeCallback;
      if (disposeCallback) {
        disposeCallback();
      }

      expect(TaskDetailProvider['currentFilePath']).toBeUndefined();
    });
  });

  describe('getCurrentTaskId', () => {
    it('should return undefined when no task is open', () => {
      expect(TaskDetailProvider.getCurrentTaskId()).toBeUndefined();
    });

    it('should return the current task ID when a task is open', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');

      expect(TaskDetailProvider.getCurrentTaskId()).toBe('TASK-1');
    });

    it('should return undefined after panel is disposed', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');
      expect(TaskDetailProvider.getCurrentTaskId()).toBe('TASK-1');

      // Simulate panel disposal
      const disposeCallback = (mockPanel as { _disposeCallback?: () => void })._disposeCallback;
      if (disposeCallback) {
        disposeCallback();
      }

      expect(TaskDetailProvider.getCurrentTaskId()).toBeUndefined();
    });
  });
});
