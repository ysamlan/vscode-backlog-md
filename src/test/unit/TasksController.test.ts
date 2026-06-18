import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { createMockExtensionContext } from '../mocks/vscode';
import { TasksController, TasksHost } from '../../providers/TasksController';
import { TaskDetailProvider } from '../../providers/TaskDetailProvider';
import { BacklogParser } from '../../core/BacklogParser';
import { ExtensionMessage, Task } from '../../core/types';

/**
 * Direct unit tests for the host-agnostic TasksController, driven through a mock
 * host with no VS Code WebviewView/WebviewPanel involved. This proves the
 * controller's data loading and message handling depend only on the injected
 * TasksHost interface (TASK-164.1 AC#1, AC#6).
 */
describe('TasksController', () => {
  let mockParser: BacklogParser;
  let mockContext: vscode.ExtensionContext;
  let posted: ExtensionMessage[];
  let ready: boolean;
  let host: TasksHost;

  function createHost(kind: 'sidebar' | 'editor' = 'editor'): TasksHost {
    return {
      kind,
      postMessage: (message) => {
        posted.push(message);
      },
      isReady: () => ready,
    };
  }

  function postedTypes(): string[] {
    return posted.map((m) => m.type);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    posted = [];
    ready = true;
    mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;
    host = createHost();

    mockParser = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTasksWithCrossBranch: vi.fn().mockResolvedValue([]),
      getTask: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({}),
      getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
      getMilestones: vi.fn().mockResolvedValue([]),
      getDrafts: vi.fn().mockResolvedValue([]),
      getCompletedTasks: vi.fn().mockResolvedValue([]),
      getArchivedTasks: vi.fn().mockResolvedValue([]),
      getBacklogPath: vi.fn().mockReturnValue('/fake/backlog'),
    } as unknown as BacklogParser;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the host kind discriminator path (works with an editor host)', async () => {
    const editor = new TasksController(createHost('editor'), mockParser, mockContext);
    await editor.refresh();
    expect(postedTypes()).toContain('tasksUpdated');
  });

  it('routes all output through the injected host.postMessage', async () => {
    const controller = new TasksController(host, mockParser, mockContext);
    await controller.refresh();
    expect(posted.length).toBeGreaterThan(0);
    expect(postedTypes()).toContain('statusesUpdated');
    expect(postedTypes()).toContain('tasksUpdated');
  });

  it('does no work and posts nothing when the host is not ready', async () => {
    ready = false;
    const controller = new TasksController(host, mockParser, mockContext);
    await controller.refresh();
    expect(posted).toHaveLength(0);
    expect(mockParser.getTasks).not.toHaveBeenCalled();
  });

  it('posts noBacklogFolder when there is no parser', async () => {
    const controller = new TasksController(host, undefined, mockContext);
    await controller.refresh();
    expect(postedTypes()).toEqual(['noBacklogFolder']);
  });

  it('setViewMode persists to globalState and posts activeTabChanged', () => {
    const controller = new TasksController(host, mockParser, mockContext);
    controller.setViewMode('list');
    expect(mockContext.globalState.get('backlog.viewMode')).toBe('list');
    expect(posted).toContainEqual({ type: 'activeTabChanged', tab: 'list' });
    expect(posted).toContainEqual({ type: 'viewModeChanged', viewMode: 'list' });
  });

  it('setFilter and setLabelFilter post their messages', () => {
    const controller = new TasksController(host, mockParser, mockContext);
    controller.setFilter('status:To Do');
    controller.setLabelFilter('bug');
    expect(posted).toContainEqual({ type: 'setFilter', filter: 'status:To Do' });
    expect(posted).toContainEqual({ type: 'setLabelFilter', label: 'bug' });
  });

  it('setActiveEditedTaskId posts activeEditedTaskChanged', () => {
    const controller = new TasksController(host, mockParser, mockContext);
    controller.setActiveEditedTaskId('TASK-7');
    expect(posted).toContainEqual({ type: 'activeEditedTaskChanged', taskId: 'TASK-7' });
  });

  it('sidebar host: selectTask drives the Details preview via the selection handler', async () => {
    vi.spyOn(TaskDetailProvider, 'hasActivePanel').mockReturnValue(false);
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const controller = new TasksController(createHost('sidebar'), mockParser, mockContext);
    controller.setTaskSelectionHandler(onSelect);

    await controller.handleMessage({
      type: 'selectTask',
      taskId: 'TASK-42',
      filePath: '/fake/backlog/tasks/task-42.md',
      source: 'local',
      branch: 'main',
    });

    expect(onSelect).toHaveBeenCalledWith({
      taskId: 'TASK-42',
      filePath: '/fake/backlog/tasks/task-42.md',
      source: 'local',
      branch: 'main',
    });
    // Sidebar single-click must not open a detail editor in a specific column.
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
      'backlog.openTaskDetail',
      expect.anything(),
      expect.objectContaining({ viewColumn: vscode.ViewColumn.Active })
    );
  });

  it('editor host: single-click opens the detail as a tab in the board group, focus kept on board', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const controller = new TasksController(createHost('editor'), mockParser, mockContext);
    controller.setTaskSelectionHandler(onSelect);

    await controller.handleMessage({
      type: 'selectTask',
      taskId: 'TASK-42',
      filePath: '/fake/backlog/tasks/task-42.md',
      source: 'local',
      branch: 'main',
    });

    // No sidebar preview handler from the editor host...
    expect(onSelect).not.toHaveBeenCalled();
    // ...instead the detail opens in the board's own group, focus retained on the board.
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'backlog.openTaskDetail',
      {
        taskId: 'TASK-42',
        filePath: '/fake/backlog/tasks/task-42.md',
        source: 'local',
        branch: 'main',
      },
      { preserveFocus: true, viewColumn: vscode.ViewColumn.Active }
    );
  });

  it('editor host: double-click opens the detail in the board group and takes focus', async () => {
    const controller = new TasksController(createHost('editor'), mockParser, mockContext);

    await controller.handleMessage({
      type: 'openTask',
      taskId: 'TASK-9',
      filePath: '/fake/backlog/tasks/task-9.md',
    });

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'backlog.openTaskDetail',
      {
        taskId: 'TASK-9',
        filePath: '/fake/backlog/tasks/task-9.md',
        source: undefined,
        branch: undefined,
      },
      { viewColumn: vscode.ViewColumn.Active }
    );
  });

  it('sidebar host: double-click opens the detail without the beside hint', async () => {
    const controller = new TasksController(createHost('sidebar'), mockParser, mockContext);

    await controller.handleMessage({
      type: 'openTask',
      taskId: 'TASK-9',
      filePath: '/fake/backlog/tasks/task-9.md',
    });

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('backlog.openTaskDetail', {
      taskId: 'TASK-9',
      filePath: '/fake/backlog/tasks/task-9.md',
      source: undefined,
      branch: undefined,
    });
  });

  it('blocks status updates for read-only cross-branch tasks', async () => {
    (mockParser.getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'TASK-REMOTE',
      title: 'Remote Task',
      status: 'To Do',
      source: 'remote',
      branch: 'origin/main',
      labels: [],
      assignee: [],
      dependencies: [],
      acceptanceCriteria: [],
      definitionOfDone: [],
      filePath: '/fake/.backlog/branches/origin-main/remote-task.md',
    } as Task);

    const controller = new TasksController(host, mockParser, mockContext);
    await controller.handleMessage({
      type: 'updateTaskStatus',
      taskId: 'TASK-REMOTE',
      status: 'Done',
    });

    expect(posted).toContainEqual(
      expect.objectContaining({
        type: 'taskUpdateError',
        taskId: 'TASK-REMOTE',
        message: expect.stringContaining('read-only'),
      })
    );
  });

  it('loadPersistedState restores the saved view mode from globalState', async () => {
    await mockContext.globalState.update('backlog.viewMode', 'list');
    const controller = new TasksController(host, mockParser, mockContext);
    controller.loadPersistedState();
    await controller.refresh();
    expect(posted).toContainEqual({ type: 'activeTabChanged', tab: 'list' });
  });

  it('uses the cross-branch loader when check_active_branches is enabled', async () => {
    (mockParser.getConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      check_active_branches: true,
    });
    const controller = new TasksController(host, mockParser, mockContext);
    await controller.refresh();
    expect(mockParser.getTasksWithCrossBranch).toHaveBeenCalled();
    expect(mockParser.getTasks).not.toHaveBeenCalled();
  });
});
