import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { TaskCreatePanel } from '../../providers/TaskCreatePanel';
import { BacklogParser } from '../../core/BacklogParser';
import { BacklogWriter } from '../../core/BacklogWriter';
import { TaskDetailProvider } from '../../providers/TaskDetailProvider';

// vscode mock is provided via vitest.config.ts alias

describe('TaskCreatePanel', () => {
  let extensionUri: vscode.Uri;
  let mockParser: BacklogParser;
  let mockWriter: BacklogWriter;
  let mockPanel: Partial<vscode.WebviewPanel>;
  let mockWebview: Partial<vscode.Webview>;
  let mockTaskDetailProvider: TaskDetailProvider;
  let mockTasksProvider: { refresh: Mock };
  let messageHandler: (message: unknown) => Promise<void>;
  let disposeCallback: () => void;

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
        disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
    };

    (vscode.window.createWebviewPanel as Mock).mockReturnValue(mockPanel);

    mockParser = {
      getTask: vi.fn().mockResolvedValue({
        id: 'DRAFT-1',
        filePath: '/test/backlog/drafts/draft-1.md',
        title: 'Untitled',
      }),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getUniqueLabels: vi.fn().mockResolvedValue([]),
      getUniqueAssignees: vi.fn().mockResolvedValue([]),
    } as unknown as BacklogParser;

    mockWriter = {
      createDraft: vi
        .fn()
        .mockResolvedValue({ id: 'DRAFT-1', filePath: '/test/backlog/drafts/draft-1.md' }),
      updateTask: vi.fn().mockResolvedValue(undefined),
      promoteDraft: vi.fn().mockResolvedValue('/test/backlog/tasks/task-1.md'),
    } as unknown as BacklogWriter;

    mockTaskDetailProvider = {
      openTask: vi.fn(),
    } as unknown as TaskDetailProvider;

    mockTasksProvider = { refresh: vi.fn() };

    // Clear static state between tests
    TaskCreatePanel['currentPanel'] = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function showPanel() {
    TaskCreatePanel.show(extensionUri, mockWriter, mockParser, '/test/backlog', {
      tasksProvider: mockTasksProvider,
      taskDetailProvider: mockTaskDetailProvider,
    });
  }

  describe('show', () => {
    it('should create a new webview panel', () => {
      showPanel();

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
      showPanel();
      showPanel();

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    it('should include form elements in webview content', () => {
      showPanel();

      const html = mockWebview.html as string;
      expect(html).toContain('id="titleInput"');
      expect(html).toContain('id="descriptionTextarea"');
      expect(html).toContain('id="createBtn"');
      expect(html).toContain('id="discardBtn"');
      expect(html).toContain('Create New Task');
    });

    it('should have Create Task button and Discard Draft button', () => {
      showPanel();

      const html = mockWebview.html as string;
      expect(html).toContain('>Create Task</button>');
      expect(html).toContain('>Discard Draft</button>');
    });

    it('should mark title as required in the form', () => {
      showPanel();

      const html = mockWebview.html as string;
      expect(html).toContain('Title');
      expect(html).toMatch(/required/i);
    });
  });

  describe('draft initialization', () => {
    it('should create a draft immediately on panel open', async () => {
      showPanel();

      // Wait for the async initDraft to complete
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalledWith('/test/backlog', mockParser);
      });
    });

    it('should handle draft creation failure gracefully', async () => {
      (mockWriter.createDraft as Mock).mockRejectedValue(new Error('Disk full'));

      // Should not throw
      showPanel();

      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });
    });
  });

  describe('autosave', () => {
    beforeEach(() => {
      showPanel();
    });

    it('should update draft on autosave message', async () => {
      // Wait for draft init
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      await messageHandler({
        type: 'autosave',
        title: 'My Task',
        description: 'Some description',
      });

      expect(mockWriter.updateTask).toHaveBeenCalledWith(
        'DRAFT-1',
        { title: 'My Task', description: 'Some description' },
        mockParser
      );
    });

    it('should send autosaved confirmation back to webview', async () => {
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      await messageHandler({
        type: 'autosave',
        title: 'My Task',
        description: '',
      });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({ type: 'autosaved' });
    });

    it('should skip autosave if draft not yet initialized', async () => {
      // Make createDraft never resolve (simulating slow init)
      (mockWriter.createDraft as Mock).mockReturnValue(new Promise(() => {}));

      // Force a new panel with the stalled mock
      TaskCreatePanel['currentPanel'] = undefined;
      showPanel();

      await messageHandler({
        type: 'autosave',
        title: 'My Task',
        description: '',
      });

      expect(mockWriter.updateTask).not.toHaveBeenCalled();
    });

    it('should mark hasContent when title is non-empty', async () => {
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      await messageHandler({
        type: 'autosave',
        title: 'My Task',
        description: '',
      });

      // Verify hasContent is true by checking passive close behavior
      // (passive close with content should NOT delete the draft)
      disposeCallback();

      // Give async handleDispose time to run
      await vi.waitFor(() => {
        // getTask should NOT have been called for deletion
        // (it was only called if it would delete the draft)
      });

      // Parser.getTask not called for deletion since hasContent is true
      expect(mockParser.getTask).not.toHaveBeenCalled();
    });

    it('should pass undefined for empty title and description', async () => {
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      await messageHandler({
        type: 'autosave',
        title: '',
        description: '',
      });

      expect(mockWriter.updateTask).toHaveBeenCalledWith(
        'DRAFT-1',
        { title: undefined, description: undefined },
        mockParser
      );
    });
  });

  describe('createTask (submit / promote)', () => {
    beforeEach(async () => {
      showPanel();
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });
    });

    it('should promote draft on submit', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockWriter.updateTask).toHaveBeenCalledWith(
        'DRAFT-1',
        { title: 'New Task', description: 'Description' },
        mockParser
      );
      expect(mockWriter.promoteDraft).toHaveBeenCalledWith('DRAFT-1', mockParser);
    });

    it('should dispose panel and open task detail on success', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(mockTaskDetailProvider.openTask).toHaveBeenCalledWith('DRAFT-1');
    });

    it('should refresh views on success', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockTasksProvider.refresh).toHaveBeenCalled();
    });

    it('should show success message with task title', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Created task "New Task"');
    });

    it('should pass undefined description when empty', async () => {
      await messageHandler({
        type: 'createTask',
        title: 'Minimal Task',
        description: '',
      });

      expect(mockWriter.updateTask).toHaveBeenCalledWith(
        'DRAFT-1',
        { title: 'Minimal Task', description: undefined },
        mockParser
      );
    });

    it('should send error message on promote failure', async () => {
      (mockWriter.promoteDraft as Mock).mockRejectedValue(new Error('Promote failed'));

      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'error',
        message: expect.stringContaining('Promote failed'),
      });
    });

    it('should not dispose panel on failure', async () => {
      (mockWriter.promoteDraft as Mock).mockRejectedValue(new Error('Promote failed'));

      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: 'Description',
      });

      expect(mockPanel.dispose).not.toHaveBeenCalled();
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
      expect(mockWriter.promoteDraft).not.toHaveBeenCalled();
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
      expect(mockWriter.promoteDraft).not.toHaveBeenCalled();
    });

    it('should fallback to inline create+promote if init failed', async () => {
      // Reset mock calls from previous showPanel in beforeEach
      (mockWriter.createDraft as Mock).mockReset();
      (mockWriter.createDraft as Mock)
        .mockRejectedValueOnce(new Error('Init failed'))
        .mockResolvedValueOnce({ id: 'DRAFT-2', filePath: '/test/backlog/drafts/draft-2.md' });
      (mockWriter.updateTask as Mock).mockReset().mockResolvedValue(undefined);
      (mockWriter.promoteDraft as Mock)
        .mockReset()
        .mockResolvedValue('/test/backlog/tasks/task-2.md');

      TaskCreatePanel['currentPanel'] = undefined;
      showPanel();

      // Wait for failed init
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalledTimes(1);
      });

      await messageHandler({
        type: 'createTask',
        title: 'Fallback Task',
        description: '',
      });

      // Should have called createDraft again inline
      expect(mockWriter.createDraft).toHaveBeenCalledTimes(2);
      expect(mockWriter.updateTask).toHaveBeenCalledWith(
        'DRAFT-2',
        { title: 'Fallback Task', description: undefined },
        mockParser
      );
      expect(mockWriter.promoteDraft).toHaveBeenCalledWith('DRAFT-2', mockParser);
    });
  });

  describe('discard draft', () => {
    beforeEach(async () => {
      showPanel();
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });
    });

    it('should delete draft and dispose panel', async () => {
      await messageHandler({ type: 'discardDraft' });

      expect(mockParser.getTask).toHaveBeenCalledWith('DRAFT-1');
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    it('should delete draft even when content was typed', async () => {
      // Autosave some content first
      await messageHandler({
        type: 'autosave',
        title: 'Some content',
        description: '',
      });

      await messageHandler({ type: 'discardDraft' });

      expect(mockParser.getTask).toHaveBeenCalledWith('DRAFT-1');
      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });

  describe('panel disposal (passive close)', () => {
    it('should clear currentPanel on dispose', async () => {
      showPanel();
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      expect(TaskCreatePanel['currentPanel']).toBeDefined();

      disposeCallback();

      expect(TaskCreatePanel['currentPanel']).toBeUndefined();
    });

    it('should delete empty draft on passive close', async () => {
      showPanel();
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      // Passive close without typing anything
      disposeCallback();

      await vi.waitFor(() => {
        expect(mockParser.getTask).toHaveBeenCalledWith('DRAFT-1');
      });
    });

    it('should keep draft with content on passive close', async () => {
      showPanel();
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      // Type something first
      await messageHandler({
        type: 'autosave',
        title: 'My important task',
        description: '',
      });

      // Reset mock to check it's NOT called for deletion
      (mockParser.getTask as Mock).mockClear();

      disposeCallback();

      // Give a tick for async handleDispose
      await new Promise((r) => setTimeout(r, 10));

      // getTask should NOT have been called (draft kept)
      expect(mockParser.getTask).not.toHaveBeenCalled();
    });

    it('should not double-delete on intentional close (submit)', async () => {
      showPanel();
      await vi.waitFor(() => {
        expect(mockWriter.createDraft).toHaveBeenCalled();
      });

      // Submit the task
      await messageHandler({
        type: 'createTask',
        title: 'New Task',
        description: '',
      });

      (mockParser.getTask as Mock).mockClear();

      // Panel dispose fires after submit
      disposeCallback();

      await new Promise((r) => setTimeout(r, 10));

      // Should not attempt to delete — submit already handled cleanup
      expect(mockParser.getTask).not.toHaveBeenCalled();
    });
  });
});
