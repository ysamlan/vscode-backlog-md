import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { BacklogWorkspaceManager } from '../../core/BacklogWorkspaceManager';
import * as fs from 'fs';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

// The vscode mock has a mutable workspaceFolders, but TS types it as readonly.
// Cast to allow assignment in tests.
const mockWorkspace = vscode.workspace as {
  workspaceFolders: vscode.WorkspaceFolder[] | undefined;
};

function createMockMemento(): vscode.Memento {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string, defaultValue?: T) => (store.get(key) as T) ?? defaultValue,
    update: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    keys: () => [...store.keys()],
  };
}

function makeFolder(name: string, fsPath: string): vscode.WorkspaceFolder {
  return {
    uri: { fsPath, scheme: 'file', path: fsPath } as vscode.Uri,
    name,
    index: 0,
  };
}

describe('BacklogWorkspaceManager', () => {
  let memento: vscode.Memento;

  beforeEach(() => {
    vi.clearAllMocks();
    memento = createMockMemento();
    mockWorkspace.workspaceFolders = undefined;
  });

  describe('discover()', () => {
    it('returns empty when no workspace folders', () => {
      mockWorkspace.workspaceFolders = undefined;
      const manager = new BacklogWorkspaceManager(memento);
      const roots = manager.discover();
      expect(roots).toEqual([]);
    });

    it('returns empty when no folder has backlog/', () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(false);

      const manager = new BacklogWorkspaceManager(memento);
      const roots = manager.discover();
      expect(roots).toEqual([]);
    });

    it('discovers single root with backlog/', () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      const roots = manager.discover();
      expect(roots).toHaveLength(1);
      expect(roots[0].label).toBe('projectA');
      expect(roots[0].backlogPath).toBe('/home/user/projectA/backlog');
    });

    it('discovers multiple roots', () => {
      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
        makeFolder('projectC', '/home/user/projectC'),
      ];
      (fs.existsSync as Mock).mockImplementation((path: string) => {
        return path.includes('projectA') || path.includes('projectC');
      });

      const manager = new BacklogWorkspaceManager(memento);
      const roots = manager.discover();
      expect(roots).toHaveLength(2);
      expect(roots[0].label).toBe('projectA');
      expect(roots[1].label).toBe('projectC');
    });
  });

  describe('initialize()', () => {
    it('returns undefined when no roots found', () => {
      mockWorkspace.workspaceFolders = undefined;
      const manager = new BacklogWorkspaceManager(memento);
      const result = manager.initialize();
      expect(result).toBeUndefined();
    });

    it('auto-selects single root', () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      const result = manager.initialize();
      expect(result).toBeDefined();
      expect(result!.label).toBe('projectA');
      expect(manager.getActiveRoot()).toBe(result);
    });

    it('auto-selects first root when multiple exist', () => {
      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
      ];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      const result = manager.initialize();
      expect(result!.label).toBe('projectA');
    });

    it('restores persisted selection', async () => {
      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
      ];
      (fs.existsSync as Mock).mockReturnValue(true);

      // Pre-persist projectB
      await memento.update('backlog.activeBacklogPath', '/home/user/projectB/backlog');

      const manager = new BacklogWorkspaceManager(memento);
      const result = manager.initialize();
      expect(result!.label).toBe('projectB');
    });

    it('falls back to first when persisted path is gone', async () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(true);

      // Persist a path that no longer exists
      await memento.update('backlog.activeBacklogPath', '/home/user/removed/backlog');

      const manager = new BacklogWorkspaceManager(memento);
      const result = manager.initialize();
      expect(result!.label).toBe('projectA');
    });
  });

  describe('setActiveRoot()', () => {
    it('fires onDidChangeActiveRoot event', () => {
      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
      ];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();

      const handler = vi.fn();
      manager.onDidChangeActiveRoot(handler);

      const roots = manager.getRoots();
      manager.setActiveRoot(roots[1]);

      expect(handler).toHaveBeenCalledWith(roots[1]);
      expect(manager.getActiveRoot()).toBe(roots[1]);
    });

    it('persists active path', async () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();

      manager.setActiveRoot(manager.getRoots()[0]);
      expect(memento.get('backlog.activeBacklogPath')).toBe('/home/user/projectA/backlog');
    });
  });

  describe('addRoot()', () => {
    it('adds root and fires event', () => {
      mockWorkspace.workspaceFolders = [];
      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();

      const handler = vi.fn();
      manager.onDidChangeActiveRoot(handler);

      const folder = makeFolder('newProject', '/home/user/newProject');
      const root = {
        backlogPath: '/home/user/newProject/backlog',
        workspaceFolder: folder,
        label: 'newProject',
      };

      manager.addRoot(root);

      expect(manager.getRoots()).toHaveLength(1);
      expect(manager.getActiveRoot()).toBe(root);
      expect(handler).toHaveBeenCalledWith(root);
    });

    it('does not duplicate existing root', () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();
      expect(manager.getRoots()).toHaveLength(1);

      const folder = makeFolder('projectA', '/home/user/projectA');
      manager.addRoot({
        backlogPath: '/home/user/projectA/backlog',
        workspaceFolder: folder,
        label: 'projectA',
      });

      expect(manager.getRoots()).toHaveLength(1);
    });
  });

  describe('selectBacklog()', () => {
    it('returns undefined when no roots', async () => {
      mockWorkspace.workspaceFolders = undefined;
      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();

      const result = await manager.selectBacklog();
      expect(result).toBeUndefined();
    });

    it('auto-returns single root without Quick Pick', async () => {
      mockWorkspace.workspaceFolders = [makeFolder('projectA', '/home/user/projectA')];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();

      const result = await manager.selectBacklog();
      expect(result!.label).toBe('projectA');
      expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('shows Quick Pick when multiple roots', async () => {
      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
      ];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.discover();

      // Mock user picking projectB
      (vscode.window.showQuickPick as Mock).mockResolvedValue({
        label: 'projectB',
        description: '/home/user/projectB/backlog',
        root: manager.getRoots()[1],
      });

      const handler = vi.fn();
      manager.onDidChangeActiveRoot(handler);

      const result = await manager.selectBacklog();
      expect(result!.label).toBe('projectB');
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it('keeps current root when Quick Pick is cancelled', async () => {
      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
      ];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.initialize();

      (vscode.window.showQuickPick as Mock).mockResolvedValue(undefined);

      const result = await manager.selectBacklog();
      expect(result!.label).toBe('projectA');
    });
  });

  describe('workspace folder changes', () => {
    it('re-discovers on workspace folder change and handles removed root', () => {
      let folderChangeHandler: (() => void) | undefined;
      (vscode.workspace.onDidChangeWorkspaceFolders as Mock).mockImplementation(
        (handler: () => void) => {
          folderChangeHandler = handler;
          return { dispose: vi.fn() };
        }
      );

      mockWorkspace.workspaceFolders = [
        makeFolder('projectA', '/home/user/projectA'),
        makeFolder('projectB', '/home/user/projectB'),
      ];
      (fs.existsSync as Mock).mockReturnValue(true);

      const manager = new BacklogWorkspaceManager(memento);
      manager.initialize();
      manager.startWatching();

      // Simulate removing projectA (the active root)
      const eventHandler = vi.fn();
      manager.onDidChangeActiveRoot(eventHandler);

      mockWorkspace.workspaceFolders = [makeFolder('projectB', '/home/user/projectB')];

      folderChangeHandler!();

      // Should have fallen back to projectB
      expect(manager.getActiveRoot()!.label).toBe('projectB');
      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    it('cleans up without error', () => {
      const manager = new BacklogWorkspaceManager(memento);
      expect(() => manager.dispose()).not.toThrow();
    });
  });
});
