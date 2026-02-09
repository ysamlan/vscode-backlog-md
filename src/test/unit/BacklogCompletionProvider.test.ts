import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacklogCompletionProvider } from '../../language/BacklogCompletionProvider';
import { createMockTextDocument, Position, CompletionItemKind } from '../mocks/vscode';
import type { BacklogParser } from '../../core/BacklogParser';
import type { CancellationToken, CompletionContext } from 'vscode';

function createMockParser(overrides?: Partial<BacklogParser>): BacklogParser {
  return {
    getStatuses: vi.fn().mockResolvedValue(['To Do', 'In Progress', 'Done']),
    getMilestones: vi.fn().mockResolvedValue([
      { id: 'm-1', name: 'v1.0' },
      { id: 'm-2', name: 'v2.0' },
    ]),
    getUniqueLabels: vi.fn().mockResolvedValue(['bug', 'feature', 'ui']),
    getUniqueAssignees: vi.fn().mockResolvedValue(['@alice', '@bob']),
    getTasks: vi.fn().mockResolvedValue([
      {
        id: 'TASK-1',
        title: 'First task',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/TASK-1.md',
      },
      {
        id: 'TASK-2',
        title: 'Second task',
        status: 'In Progress',
        priority: 'high',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/TASK-2.md',
      },
    ]),
    ...overrides,
  } as unknown as BacklogParser;
}

const mockToken = {} as CancellationToken;
const mockContext = {} as CompletionContext;

describe('BacklogCompletionProvider', () => {
  let parser: BacklogParser;
  let provider: BacklogCompletionProvider;

  beforeEach(() => {
    parser = createMockParser();
    provider = new BacklogCompletionProvider(parser);
  });

  describe('frontmatter completions', () => {
    it('provides status completions', async () => {
      const doc = createMockTextDocument('---\nstatus: \n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 8),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items).toHaveLength(3);
      expect(result!.items.map((i) => i.label)).toEqual(['To Do', 'In Progress', 'Done']);
      expect(result!.items[0].kind).toBe(CompletionItemKind.EnumMember);
    });

    it('provides priority completions', async () => {
      const doc = createMockTextDocument('---\npriority: \n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 10),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items.map((i) => i.label)).toEqual(['high', 'medium', 'low']);
    });

    it('provides milestone completions', async () => {
      const doc = createMockTextDocument('---\nmilestone: \n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 11),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items.map((i) => i.label)).toEqual(['v1.0', 'v2.0']);
      expect(result!.items[0].kind).toBe(CompletionItemKind.Value);
    });

    it('provides label completions', async () => {
      const doc = createMockTextDocument('---\nlabels: []\n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 9),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items.map((i) => i.label)).toEqual(['bug', 'feature', 'ui']);
      expect(result!.items[0].kind).toBe(CompletionItemKind.Keyword);
    });

    it('provides assignee completions', async () => {
      const doc = createMockTextDocument('---\nassignee: \n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 10),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items.map((i) => i.label)).toEqual(['@alice', '@bob']);
    });

    it('provides dependency completions with task titles', async () => {
      const doc = createMockTextDocument('---\ndependencies: []\n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 16),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items).toHaveLength(2);
      expect(result!.items[0].label).toBe('TASK-1');
      expect(result!.items[0].detail).toBe('First task');
      expect(result!.items[0].kind).toBe(CompletionItemKind.Reference);
    });

    it('returns undefined for unknown frontmatter field', async () => {
      const doc = createMockTextDocument('---\nunknown_field: \n---\n');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(1, 16),
        mockToken,
        mockContext
      );
      expect(result).toBeUndefined();
    });
  });

  describe('body task ID completions', () => {
    it('provides task ID completions when typing a prefix', async () => {
      const doc = createMockTextDocument('---\nid: TASK-5\n---\n\nDepends on TASK-');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(4, 16),
        mockToken,
        mockContext
      );
      expect(result).toBeDefined();
      expect(result!.items).toHaveLength(2);
      expect(result!.items[0].label).toBe('TASK-1');
      expect(result!.items[0].detail).toBe('First task');
    });

    it('returns undefined when not typing a task ID prefix', async () => {
      const doc = createMockTextDocument('---\nid: TASK-5\n---\n\nJust some text');
      const result = await provider.provideCompletionItems(
        doc as never,
        new Position(4, 14),
        mockToken,
        mockContext
      );
      expect(result).toBeUndefined();
    });
  });

  it('provides completions for assignees field alias', async () => {
    const doc = createMockTextDocument('---\nassignees: \n---\n');
    const result = await provider.provideCompletionItems(
      doc as never,
      new Position(1, 11),
      mockToken,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result!.items.map((i) => i.label)).toEqual(['@alice', '@bob']);
  });
});
