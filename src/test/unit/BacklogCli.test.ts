import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock function is created before vi.mock runs
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));

// Mock vscode first
vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
    createStatusBarItem: vi.fn().mockReturnValue({
      text: '',
      tooltip: '',
      backgroundColor: undefined,
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      name: '',
    }),
  },
  env: {
    openExternal: vi.fn(),
  },
  Uri: {
    parse: vi.fn((url: string) => ({ toString: () => url })),
  },
  StatusBarAlignment: {
    Right: 2,
  },
}));

// Mock child_process exec with promisify behavior
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));
vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}));

// Import after mocks
import { BacklogCli } from '../../core/BacklogCli';
import * as vscode from 'vscode';

describe('BacklogCli', () => {
  beforeEach(() => {
    // Clear cache before each test
    BacklogCli.clearCache();
    vi.clearAllMocks();
    mockExecAsync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return available: true when CLI is found on PATH', async () => {
      // First call: which backlog
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/local/bin/backlog\n', stderr: '' });
      // Second call: backlog --version
      mockExecAsync.mockResolvedValueOnce({ stdout: 'backlog 1.2.3', stderr: '' });

      const result = await BacklogCli.isAvailable();

      expect(result.available).toBe(true);
      expect(result.path).toBe('/usr/local/bin/backlog');
      expect(result.version).toBe('backlog 1.2.3');
      expect(result.error).toBeUndefined();
    });

    it('should return available: false when CLI is not found', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('command not found: backlog'));

      const result = await BacklogCli.isAvailable();

      expect(result.available).toBe(false);
      expect(result.error).toBe('backlog CLI not found on PATH');
      expect(result.path).toBeUndefined();
    });

    it('should cache the result for subsequent calls', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/bin/backlog\n', stderr: '' });
      mockExecAsync.mockResolvedValueOnce({ stdout: 'backlog 2.0.0', stderr: '' });

      // First call
      const result1 = await BacklogCli.isAvailable();
      // Second call should use cache
      const result2 = await BacklogCli.isAvailable();

      expect(result1).toEqual(result2);
      // exec should only be called twice (once for which, once for version) not four times
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    it('should handle CLI found but version check fails gracefully', async () => {
      // which succeeds
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/bin/backlog', stderr: '' });
      // version fails
      mockExecAsync.mockRejectedValueOnce(new Error('unknown option --version'));

      const result = await BacklogCli.isAvailable();

      expect(result.available).toBe(true);
      expect(result.path).toBe('/usr/bin/backlog');
      expect(result.version).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear the cached availability result', async () => {
      // First call setup
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/bin/backlog', stderr: '' });
      mockExecAsync.mockResolvedValueOnce({ stdout: 'v1.0.0', stderr: '' });

      await BacklogCli.isAvailable();
      expect(mockExecAsync).toHaveBeenCalledTimes(2);

      // Clear cache
      BacklogCli.clearCache();

      // Setup for second call after clear
      mockExecAsync.mockRejectedValueOnce(new Error('not found'));

      const result = await BacklogCli.isAvailable();

      // Should have made another call after cache clear
      expect(mockExecAsync).toHaveBeenCalledTimes(3);
      expect(result.available).toBe(false);
    });
  });

  describe('showCrossbranchWarning', () => {
    it('should show a warning message with Learn More option', () => {
      BacklogCli.showCrossbranchWarning();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Cross-branch task features require the backlog CLI'),
        'Learn More',
        'Dismiss'
      );
    });
  });

  describe('createStatusBarItem', () => {
    it('should create a status bar item', () => {
      const statusBarItem = BacklogCli.createStatusBarItem();

      expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
      expect(statusBarItem).toBeDefined();
    });
  });

  describe('updateStatusBarItem', () => {
    it('should update status bar to show local-only mode', () => {
      const mockStatusBarItem = {
        text: '',
        tooltip: '',
        backgroundColor: undefined as unknown,
        show: vi.fn(),
        hide: vi.fn(),
      };

      BacklogCli.updateStatusBarItem(mockStatusBarItem as any, 'local-only', 'CLI not installed');

      expect(mockStatusBarItem.text).toBe('$(database) Backlog: Local Only');
      expect(mockStatusBarItem.tooltip).toBe('CLI not installed');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should update status bar to show cross-branch mode', () => {
      const mockStatusBarItem = {
        text: '',
        tooltip: '',
        backgroundColor: undefined as unknown,
        show: vi.fn(),
        hide: vi.fn(),
      };

      BacklogCli.updateStatusBarItem(mockStatusBarItem as any, 'cross-branch');

      expect(mockStatusBarItem.text).toBe('$(git-branch) Backlog: Cross-Branch');
      expect(mockStatusBarItem.tooltip).toBe('Viewing tasks across all branches');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should hide status bar when mode is hidden', () => {
      const mockStatusBarItem = {
        text: '',
        tooltip: '',
        backgroundColor: undefined as unknown,
        show: vi.fn(),
        hide: vi.fn(),
      };

      BacklogCli.updateStatusBarItem(mockStatusBarItem as any, 'hidden');

      expect(mockStatusBarItem.hide).toHaveBeenCalled();
      expect(mockStatusBarItem.show).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should return null when CLI is not available', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not found'));

      const result = await BacklogCli.execute(['list', '--json'], '/workspace');

      expect(result).toBeNull();
    });

    it('should execute command and return output when CLI is available', async () => {
      // isAvailable: which
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/bin/backlog', stderr: '' });
      // isAvailable: version
      mockExecAsync.mockResolvedValueOnce({ stdout: 'v1.0', stderr: '' });
      // execute: actual command
      mockExecAsync.mockResolvedValueOnce({ stdout: '{"tasks": []}', stderr: '' });

      const result = await BacklogCli.execute(['list', '--json'], '/workspace');

      expect(result).toBe('{"tasks": []}');
    });

    it('should return null when command execution fails', async () => {
      // isAvailable: which
      mockExecAsync.mockResolvedValueOnce({ stdout: '/usr/bin/backlog', stderr: '' });
      // isAvailable: version
      mockExecAsync.mockResolvedValueOnce({ stdout: 'v1.0', stderr: '' });
      // execute: command fails
      mockExecAsync.mockRejectedValueOnce(new Error('command failed'));

      const result = await BacklogCli.execute(['list'], '/workspace');

      expect(result).toBeNull();
    });
  });
});
