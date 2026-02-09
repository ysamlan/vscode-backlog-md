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

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }

  get isSingleLine(): boolean {
    return this.start.line === this.end.line;
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Range) {
      return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }
    return positionOrRange.isAfterOrEqual(this.start) && positionOrRange.isBeforeOrEqual(this.end);
  }

  intersection(range: Range): Range | undefined {
    const start = range.start.isAfter(this.start) ? range.start : this.start;
    const end = range.end.isBefore(this.end) ? range.end : this.end;
    if (start.isAfter(end)) return undefined;
    return new Range(start, end);
  }

  union(other: Range): Range {
    const start = other.start.isBefore(this.start) ? other.start : this.start;
    const end = other.end.isAfter(this.end) ? other.end : this.end;
    return new Range(start, end);
  }

  with(startOrChange?: Position | { start?: Position; end?: Position }, end?: Position): Range {
    if (startOrChange && !(startOrChange instanceof Position)) {
      return new Range(startOrChange.start ?? this.start, startOrChange.end ?? this.end);
    }
    return new Range((startOrChange as Position | undefined) ?? this.start, end ?? this.end);
  }

  isEqual(other: Range): boolean {
    return this.start.isEqual(other.start) && this.end.isEqual(other.end);
  }
}

// Position class mock
export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isBeforeOrEqual(other: Position): boolean {
    return (
      this.line < other.line || (this.line === other.line && this.character <= other.character)
    );
  }

  isAfter(other: Position): boolean {
    return this.line > other.line || (this.line === other.line && this.character > other.character);
  }

  isAfterOrEqual(other: Position): boolean {
    return (
      this.line > other.line || (this.line === other.line && this.character >= other.character)
    );
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  compareTo(other: Position): number {
    if (this.line < other.line) return -1;
    if (this.line > other.line) return 1;
    if (this.character < other.character) return -1;
    if (this.character > other.character) return 1;
    return 0;
  }

  translate(
    lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number },
    characterDelta?: number
  ): Position {
    if (typeof lineDeltaOrChange === 'object') {
      return new Position(
        this.line + (lineDeltaOrChange.lineDelta || 0),
        this.character + (lineDeltaOrChange.characterDelta || 0)
      );
    }
    return new Position(
      this.line + (lineDeltaOrChange || 0),
      this.character + (characterDelta || 0)
    );
  }

  with(
    lineOrChange?: number | { line?: number; character?: number },
    character?: number
  ): Position {
    if (typeof lineOrChange === 'object') {
      return new Position(lineOrChange.line ?? this.line, lineOrChange.character ?? this.character);
    }
    return new Position(lineOrChange ?? this.line, character ?? this.character);
  }
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

// Languages mock implementation
export const languages = {
  registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  registerDocumentLinkProvider: vi.fn(() => ({ dispose: vi.fn() })),
  registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

// CompletionItemKind enum
export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
  User = 25,
}

// CompletionItem class mock
export class CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string | MarkdownString;
  sortText?: string;
  filterText?: string;
  insertText?: string | SnippetString;

  constructor(label: string, kind?: CompletionItemKind) {
    this.label = label;
    this.kind = kind;
  }
}

// CompletionList class mock
export class CompletionList {
  items: CompletionItem[];
  isIncomplete: boolean;

  constructor(items?: CompletionItem[], isIncomplete?: boolean) {
    this.items = items || [];
    this.isIncomplete = isIncomplete || false;
  }
}

// DocumentLink class mock
export class DocumentLink {
  range: Range;
  target?: { fsPath: string; scheme: string; path: string };
  tooltip?: string;

  constructor(range: Range, target?: { fsPath: string; scheme: string; path: string }) {
    this.range = range;
    this.target = target;
  }
}

// Hover class mock
export class Hover {
  contents: MarkdownString[];
  range?: Range;

  constructor(contents: MarkdownString | MarkdownString[], range?: Range) {
    this.contents = Array.isArray(contents) ? contents : [contents];
    this.range = range;
  }
}

// MarkdownString class mock
export class MarkdownString {
  value: string;
  isTrusted: boolean;

  constructor(value?: string) {
    this.value = value || '';
    this.isTrusted = false;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(code: string, language?: string): MarkdownString {
    this.value += `\`\`\`${language || ''}\n${code}\n\`\`\`\n`;
    return this;
  }
}

// SnippetString class mock
export class SnippetString {
  value: string;

  constructor(value?: string) {
    this.value = value || '';
  }
}

/**
 * Helper to create a mock TextDocument for testing language providers.
 */
export function createMockTextDocument(
  content: string,
  uri?: string
): {
  getText: (range?: Range) => string;
  lineAt: (line: number) => { text: string; range: Range };
  lineCount: number;
  uri: { fsPath: string; scheme: string; path: string };
  getWordRangeAtPosition: (position: Position, regex?: RegExp) => Range | undefined;
} {
  const lines = content.split('\n');
  const docUri = uri || '/test/backlog/tasks/TASK-1 - Test.md';
  return {
    getText(range?: Range): string {
      if (!range) return content;
      if (range.start.line === range.end.line) {
        return (lines[range.start.line] || '').substring(
          range.start.character,
          range.end.character
        );
      }
      const result: string[] = [];
      for (let i = range.start.line; i <= range.end.line; i++) {
        const line = lines[i] || '';
        if (i === range.start.line) result.push(line.substring(range.start.character));
        else if (i === range.end.line) result.push(line.substring(0, range.end.character));
        else result.push(line);
      }
      return result.join('\n');
    },
    lineAt(line: number) {
      const text = lines[line] || '';
      return {
        text,
        range: new Range(new Position(line, 0), new Position(line, text.length)),
      };
    },
    lineCount: lines.length,
    uri: { fsPath: docUri, scheme: 'file', path: docUri },
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined {
      if (!regex) return undefined;
      const lineText = lines[position.line] || '';
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((match = regex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new Range(new Position(position.line, start), new Position(position.line, end));
        }
      }
      return undefined;
    },
  };
}

// Helper to reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks();
}
