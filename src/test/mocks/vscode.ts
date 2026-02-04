/**
 * Centralized vscode module mock for unit tests.
 *
 * This file provides a comprehensive mock of the vscode API used throughout
 * the extension. By centralizing mocks here, test files can be cleaner and
 * the mock implementations can be maintained in one place.
 *
 * The mock is automatically applied via the vitest.config.ts alias:
 *   alias: { vscode: path.resolve(__dirname, 'src/test/mocks/vscode.ts') }
 *
 * This means test files don't need to call vi.mock('vscode') - imports of
 * 'vscode' are automatically resolved to this file.
 *
 * To customize mock behavior in individual tests:
 *   import * as vscode from 'vscode';
 *   import { Mock } from 'vitest';
 *   (vscode.window.showErrorMessage as Mock).mockResolvedValue('Yes');
 */

import { vi } from 'vitest';

// Uri mock implementation
export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
    fsPath: [base.fsPath, ...segments].join('/'),
    scheme: 'file',
    path: [base.fsPath, ...segments].join('/'),
  }),
  parse: (value: string) => ({
    fsPath: value,
    scheme: 'file',
    path: value,
  }),
};

// Window mock implementation
export const window = {
  createWebviewPanel: vi.fn(),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  withProgress: vi.fn((options, task) => task({ report: vi.fn() })),
  activeTextEditor: undefined,
  visibleTextEditors: [],
  onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
  registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

// Commands mock implementation
export const commands = {
  registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  executeCommand: vi.fn(),
  getCommands: vi.fn(() => Promise.resolve([])),
};

// Env mock implementation
export const env = {
  openExternal: vi.fn(),
  clipboard: {
    readText: vi.fn(),
    writeText: vi.fn(),
  },
  language: 'en',
  machineId: 'test-machine-id',
  sessionId: 'test-session-id',
  uriScheme: 'vscode',
  appName: 'Visual Studio Code',
  appRoot: '/app',
};

// Workspace mock implementation
export const workspace = {
  workspaceFolders: undefined as { uri: { fsPath: string }; name: string }[] | undefined,
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn(),
    has: vi.fn(),
    inspect: vi.fn(),
  })),
  createFileSystemWatcher: vi.fn(() => ({
    onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
    onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
  })),
  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    readDirectory: vi.fn(),
    createDirectory: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
  },
  openTextDocument: vi.fn(),
  applyEdit: vi.fn(),
  findFiles: vi.fn(() => Promise.resolve([])),
};

// ViewColumn enum
export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
}

// StatusBarAlignment enum
export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

// TreeItemCollapsibleState enum
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

// ProgressLocation enum
export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// EventEmitter class mock
export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
  };

  fire(data: T) {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose() {
    this.listeners = [];
  }
}

// Disposable class mock
export class Disposable {
  private disposed = false;

  static from(...disposables: { dispose: () => void }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }

  constructor(private callOnDispose: () => void) {}

  dispose() {
    if (!this.disposed) {
      this.disposed = true;
      this.callOnDispose();
    }
  }
}

// ThemeIcon class mock
export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: { id: string }
  ) {}
}

// TreeItem class mock
export class TreeItem {
  label?: string;
  description?: string;
  tooltip?: string;
  collapsibleState?: TreeItemCollapsibleState;
  iconPath?: string | ThemeIcon;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;

  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

// Range class mock
export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}

  static isRange(thing: unknown): thing is Range {
    return thing instanceof Range;
  }
}

// Position class mock
export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

// Selection class mock
export class Selection extends Range {
  constructor(
    public readonly anchor: Position,
    public readonly active: Position
  ) {
    super(anchor, active);
  }
}

// WorkspaceEdit class mock
export class WorkspaceEdit {
  private edits: Map<string, { range: Range; newText: string }[]> = new Map();

  replace(uri: { fsPath: string }, range: Range, newText: string) {
    const key = uri.fsPath;
    if (!this.edits.has(key)) {
      this.edits.set(key, []);
    }
    this.edits.get(key)!.push({ range, newText });
  }

  insert(uri: { fsPath: string }, position: Position, newText: string) {
    this.replace(uri, new Range(position, position), newText);
  }

  delete(uri: { fsPath: string }, range: Range) {
    this.replace(uri, range, '');
  }
}

// Extension context mock helper
export interface ExtensionContext {
  subscriptions: { dispose: () => void }[];
  extensionUri: { fsPath: string };
  extensionPath: string;
  globalState: {
    get: <T>(key: string, defaultValue?: T) => T | undefined;
    update: (key: string, value: unknown) => Promise<void>;
    keys: () => readonly string[];
  };
  workspaceState: {
    get: <T>(key: string, defaultValue?: T) => T | undefined;
    update: (key: string, value: unknown) => Promise<void>;
    keys: () => readonly string[];
  };
  globalStorageUri: { fsPath: string };
  storageUri: { fsPath: string } | undefined;
  logUri: { fsPath: string };
  asAbsolutePath: (relativePath: string) => string;
}

export function createMockExtensionContext(
  overrides?: Partial<ExtensionContext>
): ExtensionContext {
  const storage = new Map<string, unknown>();

  return {
    subscriptions: [],
    extensionUri: { fsPath: '/test/extension' },
    extensionPath: '/test/extension',
    globalState: {
      get: <T>(key: string, defaultValue?: T) => (storage.get(key) as T) ?? defaultValue,
      update: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
      keys: () => [...storage.keys()],
    },
    workspaceState: {
      get: <T>(key: string, defaultValue?: T) => (storage.get(key) as T) ?? defaultValue,
      update: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
      keys: () => [...storage.keys()],
    },
    globalStorageUri: { fsPath: '/test/global-storage' },
    storageUri: { fsPath: '/test/storage' },
    logUri: { fsPath: '/test/logs' },
    asAbsolutePath: (relativePath: string) => `/test/extension/${relativePath}`,
    ...overrides,
  };
}

// Helper to reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks();
}
