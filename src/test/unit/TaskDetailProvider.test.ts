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
  unlinkSync: vi.fn(),
}));

// Mock marked module
vi.mock('marked', () => ({
  marked: {
    setOptions: vi.fn(),
    parse: vi.fn((markdown: string) => `<p>${markdown}</p>`),
  },
}));

// Mock BacklogWriter
const mockWriter = {
  updateTask: vi.fn().mockResolvedValue(undefined),
  toggleChecklistItem: vi.fn().mockResolvedValue(undefined),
  promoteDraft: vi.fn().mockResolvedValue(undefined),
  archiveTask: vi.fn().mockResolvedValue(undefined),
  restoreArchivedTask: vi.fn().mockResolvedValue('/fake/backlog/tasks/task-5.md'),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  createSubtask: vi
    .fn()
    .mockResolvedValue({ id: 'TASK-99', filePath: '/fake/backlog/tasks/task-99.md' }),
};
vi.mock('../../core/BacklogWriter', () => ({
  BacklogWriter: vi.fn(function () {
    return mockWriter;
  }),
  computeContentHash: vi.fn(() => 'mock-hash'),
  FileConflictError: class FileConflictError extends Error {},
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
      postMessage: vi.fn().mockResolvedValue(true),
      cspSource: 'test-csp',
    };

    mockPanel = {
      webview: mockWebview as vscode.Webview,
      reveal: vi.fn(),
      title: '',
      visible: true,
      dispose: vi.fn(),
      onDidDispose: vi.fn((callback: () => void) => {
        // Store callback for later invocation in tests
        (mockPanel as { _disposeCallback?: () => void })._disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
      onDidChangeViewState: vi.fn(() => {
        return { dispose: vi.fn() };
      }),
    };

    (vscode.window.createWebviewPanel as Mock).mockReturnValue(mockPanel);

    mockParser = {
      getTask: vi.fn(),
      getTasksWithCrossBranch: vi.fn().mockResolvedValue([]),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getUniqueLabels: vi.fn().mockResolvedValue([]),
      getUniqueAssignees: vi.fn().mockResolvedValue([]),
      getMilestones: vi.fn().mockResolvedValue([]),
      getTasks: vi.fn().mockResolvedValue([]),
      getBlockedByThisTask: vi.fn().mockResolvedValue([]),
      getCompletedTasks: vi.fn().mockResolvedValue([]),
      getArchivedTasks: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;

    // Reset fs mocks
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue('# Test Task\nContent');

    // Reset writer mocks
    mockWriter.updateTask.mockResolvedValue(undefined);
    mockWriter.toggleChecklistItem.mockResolvedValue(undefined);
    mockWriter.promoteDraft.mockResolvedValue(undefined);
    mockWriter.archiveTask.mockResolvedValue(undefined);
    mockWriter.restoreArchivedTask.mockResolvedValue('/fake/backlog/tasks/task-5.md');
    mockWriter.deleteTask.mockResolvedValue(undefined);
    mockWriter.createSubtask.mockResolvedValue({
      id: 'TASK-99',
      filePath: '/fake/backlog/tasks/task-99.md',
    });

    // Clear static state between tests
    TaskDetailProvider['currentPanel'] = undefined;
    TaskDetailProvider['currentTaskId'] = undefined;
    TaskDetailProvider['currentTaskRef'] = undefined;
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

    it('should resolve cross-branch task by filePath when opening with source metadata', async () => {
      const localPath = '/test/backlog/tasks/task-1.md';
      const branchPath = '/test/.backlog/branches/feature-x/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Local Task',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: localPath,
        source: 'local',
      });
      (mockParser.getTasksWithCrossBranch as Mock).mockResolvedValue([
        {
          id: 'TASK-1',
          title: 'Local Task',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: localPath,
          source: 'local',
        },
        {
          id: 'TASK-1',
          title: 'Branch Task',
          status: 'In Progress',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: branchPath,
          source: 'local-branch',
          branch: 'feature/x',
        },
      ]);

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask({
        taskId: 'TASK-1',
        filePath: branchPath,
        source: 'local-branch',
        branch: 'feature/x',
      });

      expect(TaskDetailProvider['currentFilePath']).toBe(branchPath);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.task.title).toBe('Branch Task');
    });

    it('should keep local resolution when metadata matches the local file', async () => {
      const localPath = '/test/backlog/tasks/task-1.md';
      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Local Task',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: localPath,
        source: 'local',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask({
        taskId: 'TASK-1',
        filePath: localPath,
        source: 'local',
      });

      expect(mockParser.getTasksWithCrossBranch).not.toHaveBeenCalled();
      expect(TaskDetailProvider['currentFilePath']).toBe(localPath);
    });
  });

  describe('sendTaskData isDraft', () => {
    it('should set isDraft: true when task folder is drafts', async () => {
      const filePath = '/test/backlog/drafts/draft-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'DRAFT-1',
        title: 'Draft Task',
        description: 'Description',
        status: 'Draft',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
        folder: 'drafts',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('DRAFT-1');

      // Wait for setTimeout in openTask
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isDraft).toBe(true);
    });

    it('should set isDraft: false when task folder is tasks', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Regular Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
        folder: 'tasks',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');

      // Wait for setTimeout in openTask
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isDraft).toBe(false);
    });
  });

  describe('sendTaskData subtask info', () => {
    it('should include parentTask when task has parentTaskId', async () => {
      const filePath = '/test/backlog/tasks/task-2.1.md';

      (mockParser.getTask as Mock).mockImplementation(async (id: string) => {
        if (id === 'TASK-2.1') {
          return {
            id: 'TASK-2.1',
            title: 'Subtask',
            status: 'To Do',
            labels: [],
            assignee: [],
            dependencies: [],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
            parentTaskId: 'TASK-2',
          };
        }
        if (id === 'TASK-2') {
          return {
            id: 'TASK-2',
            title: 'Parent Task',
            status: 'In Progress',
            labels: [],
            assignee: [],
            dependencies: [],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath: '/test/backlog/tasks/task-2.md',
          };
        }
        return undefined;
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-2.1');

      // Wait for setTimeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.parentTask).toEqual({
        id: 'TASK-2',
        title: 'Parent Task',
      });
    });

    it('should resolve parentTask from cross-branch context for read-only subtasks', async () => {
      const childPath = '/test/.backlog/branches/feature/backlog/tasks/task-2.1.md';
      const parentPath = '/test/.backlog/branches/feature/backlog/tasks/task-2.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-2.1',
        title: 'Remote Subtask',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: childPath,
        source: 'local-branch',
        branch: 'feature/x',
        parentTaskId: 'TASK-2',
      });
      (mockParser.getTasks as Mock).mockResolvedValue([]);
      (mockParser.getTasksWithCrossBranch as Mock).mockResolvedValue([
        {
          id: 'TASK-2',
          title: 'Remote Parent',
          status: 'In Progress',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: parentPath,
          source: 'local-branch',
          branch: 'feature/x',
        },
        {
          id: 'TASK-2.1',
          title: 'Remote Subtask',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: childPath,
          source: 'local-branch',
          branch: 'feature/x',
          parentTaskId: 'TASK-2',
        },
      ]);

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask({
        taskId: 'TASK-2.1',
        filePath: childPath,
        source: 'local-branch',
        branch: 'feature/x',
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.parentTask).toEqual({
        id: 'TASK-2',
        title: 'Remote Parent',
      });
    });

    it('should include subtaskSummaries when task has subtask children', async () => {
      const filePath = '/test/backlog/tasks/task-3.md';

      (mockParser.getTask as Mock).mockImplementation(async (id: string) => {
        if (id === 'TASK-3') {
          return {
            id: 'TASK-3',
            title: 'Parent',
            status: 'In Progress',
            labels: [],
            assignee: [],
            dependencies: [],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        return undefined;
      });

      // getTasks returns parent + children
      (mockParser.getTasks as Mock).mockResolvedValue([
        {
          id: 'TASK-3',
          title: 'Parent',
          status: 'In Progress',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        },
        {
          id: 'TASK-3.1',
          title: 'Child 1',
          status: 'Done',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/test/backlog/tasks/task-3.1.md',
          parentTaskId: 'TASK-3',
        },
        {
          id: 'TASK-3.2',
          title: 'Child 2',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/test/backlog/tasks/task-3.2.md',
          parentTaskId: 'TASK-3',
        },
      ]);

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-3');

      // Wait for setTimeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.subtaskSummaries).toEqual([
        { id: 'TASK-3.1', title: 'Child 1', status: 'Done' },
        { id: 'TASK-3.2', title: 'Child 2', status: 'To Do' },
      ]);
    });

    it('should not include parentTask when task has no parentTaskId', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Regular Task',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath,
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-1');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.parentTask).toBeUndefined();
      expect(taskDataCall![0].data.subtaskSummaries).toBeUndefined();
    });

    it('should include missingDependencyIds and blocked state for unresolved dependency links', async () => {
      const filePath = '/test/backlog/tasks/task-10.md';
      (mockParser.getTask as Mock).mockImplementation(async (taskId: string) => {
        if (taskId === 'TASK-10') {
          return {
            id: 'TASK-10',
            title: 'Needs missing dependency',
            status: 'To Do',
            labels: [],
            assignee: [],
            dependencies: ['TASK-404'],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        return undefined;
      });
      (mockParser.getTasks as Mock).mockResolvedValue([
        {
          id: 'TASK-10',
          title: 'Needs missing dependency',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: ['TASK-404'],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        },
      ]);

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-10');
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isBlocked).toBe(true);
      expect(taskDataCall![0].data.missingDependencyIds).toEqual(['TASK-404']);
    });

    it('should compute blocksTaskIds from cross-branch context for read-only tasks', async () => {
      const depPath = '/test/.backlog/branches/feature/backlog/tasks/task-10.md';
      const blockerPath = '/test/.backlog/branches/feature/backlog/tasks/task-11.md';
      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-10',
        title: 'Dependency Task',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: depPath,
        source: 'local-branch',
        branch: 'feature/x',
      });
      (mockParser.getTasks as Mock).mockResolvedValue([]);
      (mockParser.getBlockedByThisTask as Mock).mockResolvedValue([]);
      (mockParser.getTasksWithCrossBranch as Mock).mockResolvedValue([
        {
          id: 'TASK-10',
          title: 'Dependency Task',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: depPath,
          source: 'local-branch',
          branch: 'feature/x',
        },
        {
          id: 'TASK-11',
          title: 'Blocked Task',
          status: 'In Progress',
          labels: [],
          assignee: [],
          dependencies: ['TASK-10'],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: blockerPath,
          source: 'local-branch',
          branch: 'feature/x',
        },
      ]);

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask({
        taskId: 'TASK-10',
        filePath: depPath,
        source: 'local-branch',
        branch: 'feature/x',
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.blocksTaskIds).toEqual(['TASK-11']);
    });
  });

  describe('sendTaskData isArchived', () => {
    it('should set isArchived: true when task folder is archive', async () => {
      const filePath = '/test/backlog/archive/tasks/task-5.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-5',
        title: 'Archived Task',
        description: 'Description',
        status: 'Done',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
        folder: 'archive',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-5');

      // Wait for setTimeout in openTask
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isArchived).toBe(true);
      expect(taskDataCall![0].data.isDraft).toBe(false);
    });

    it('should set isArchived: false when task folder is tasks', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Regular Task',
        description: 'Description',
        status: 'To Do',
        priority: undefined,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: filePath,
        folder: 'tasks',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);

      await provider.openTask('TASK-1');

      // Wait for setTimeout in openTask
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isArchived).toBe(false);
    });
  });

  describe('read-only cross-branch task behavior', () => {
    it('includes read-only metadata in taskData for cross-branch tasks', async () => {
      const filePath = '/test/.backlog/branches/feature/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Cross Branch Task',
        description: 'Description',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath,
        source: 'local-branch',
        branch: 'feature/other',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isReadOnly).toBe(true);
      expect(taskDataCall![0].data.readOnlyReason).toContain('feature/other');
    });

    it('blocks updateField writes for read-only tasks', async () => {
      const filePath = '/test/.backlog/branches/feature/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Cross Branch Task',
        description: 'Description',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath,
        source: 'local-branch',
        branch: 'feature/other',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-1');

      const messageHandler = (mockWebview.onDidReceiveMessage as Mock).mock.calls[0][0];
      await messageHandler({ type: 'updateField', field: 'title', value: 'Should not save' });

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('read-only')
      );
      expect(mockWriter.updateTask).not.toHaveBeenCalled();
    });

    it('keeps local tasks editable even when branch metadata exists', async () => {
      const filePath = '/test/backlog/tasks/task-1.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-1',
        title: 'Local Task',
        description: 'Description',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath,
        source: 'local',
        branch: 'feature/current',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      const postMessageCalls = (mockWebview.postMessage as Mock).mock.calls;
      const taskDataCall = postMessageCalls.find(
        (call: unknown[]) => (call[0] as { type: string }).type === 'taskData'
      );
      expect(taskDataCall).toBeTruthy();
      expect(taskDataCall![0].data.isReadOnly).toBe(false);
      expect(taskDataCall![0].data.readOnlyReason).toBeUndefined();
    });
  });

  describe('handleMessage restoreTask', () => {
    it('should call restoreArchivedTask and close panel', async () => {
      const filePath = '/test/backlog/archive/tasks/task-5.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-5',
        title: 'Archived Task',
        status: 'Done',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath,
        folder: 'archive',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-5');

      // Get message handler
      const messageHandler = (mockWebview.onDidReceiveMessage as Mock).mock.calls[0][0];

      await messageHandler({ type: 'restoreTask', taskId: 'TASK-5' });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('restored')
      );
      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });

  describe('handleMessage deleteTask', () => {
    it('should show confirmation dialog before deleting', async () => {
      const filePath = '/test/backlog/archive/tasks/task-5.md';

      (mockParser.getTask as Mock).mockResolvedValue({
        id: 'TASK-5',
        title: 'Task to Delete',
        status: 'Done',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath,
        folder: 'archive',
      });

      const provider = new TaskDetailProvider(extensionUri, mockParser);
      await provider.openTask('TASK-5');

      const messageHandler = (mockWebview.onDidReceiveMessage as Mock).mock.calls[0][0];

      await messageHandler({ type: 'deleteTask', taskId: 'TASK-5' });

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Task to Delete'),
        expect.objectContaining({ modal: true }),
        'Delete'
      );
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
