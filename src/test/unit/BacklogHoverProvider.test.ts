import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacklogHoverProvider } from '../../language/BacklogHoverProvider';
import { createMockTextDocument, Position, MarkdownString } from '../mocks/vscode';
import type { BacklogParser } from '../../core/BacklogParser';
import type { CancellationToken } from 'vscode';
import type { Task } from '../../core/types';

/** Helper to extract MarkdownString value from hover contents */
function getHoverMarkdown(hover: { contents: unknown[] }): string {
  const first = hover.contents[0] as MarkdownString;
  return first.value;
}

function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: 'TASK-1',
    title: 'Test task',
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/backlog/tasks/TASK-1 - Test.md',
    ...overrides,
  };
}

function createMockParser(task?: Task | undefined): BacklogParser {
  return {
    getTask: vi.fn().mockResolvedValue(task),
  } as unknown as BacklogParser;
}

const mockToken = {} as CancellationToken;

describe('BacklogHoverProvider', () => {
  let provider: BacklogHoverProvider;

  describe('basic hover', () => {
    beforeEach(() => {
      const task = makeTask({
        id: 'TASK-2',
        title: 'Important feature',
        status: 'In Progress',
        priority: 'high',
        milestone: 'v1.0',
        labels: ['feature', 'ui'],
        description: 'This is the task description.',
      });
      provider = new BacklogHoverProvider(createMockParser(task));
    });

    it('shows hover info for a known task ID', async () => {
      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nBlocked by TASK-2 here.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 13), mockToken);

      expect(hover).toBeDefined();
      expect(getHoverMarkdown(hover!)).toContain('TASK-2');
      expect(getHoverMarkdown(hover!)).toContain('Important feature');
      expect(getHoverMarkdown(hover!)).toContain('In Progress');
      expect(getHoverMarkdown(hover!)).toContain('high');
      expect(getHoverMarkdown(hover!)).toContain('v1.0');
      expect(getHoverMarkdown(hover!)).toContain('feature, ui');
      expect(getHoverMarkdown(hover!)).toContain('This is the task description.');
    });
  });

  describe('unknown task', () => {
    beforeEach(() => {
      provider = new BacklogHoverProvider(createMockParser(undefined));
    });

    it('returns undefined for unknown task ID', async () => {
      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nSee TASK-999.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 6), mockToken);
      expect(hover).toBeUndefined();
    });
  });

  describe('no task ID at position', () => {
    beforeEach(() => {
      provider = new BacklogHoverProvider(createMockParser(makeTask()));
    });

    it('returns undefined when cursor is not on a task ID', async () => {
      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nJust some text.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 5), mockToken);
      expect(hover).toBeUndefined();
    });
  });

  describe('optional fields', () => {
    it('omits priority when not set', async () => {
      const task = makeTask({ id: 'TASK-3', title: 'Simple', status: 'To Do' });
      provider = new BacklogHoverProvider(createMockParser(task));

      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nSee TASK-3.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 6), mockToken);
      expect(hover).toBeDefined();
      expect(getHoverMarkdown(hover!)).not.toContain('Priority');
    });

    it('omits milestone when not set', async () => {
      const task = makeTask({ id: 'TASK-3', title: 'Simple', status: 'To Do' });
      provider = new BacklogHoverProvider(createMockParser(task));

      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nSee TASK-3.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 6), mockToken);
      expect(getHoverMarkdown(hover!)).not.toContain('Milestone');
    });

    it('omits labels when empty', async () => {
      const task = makeTask({ id: 'TASK-3', title: 'Simple', labels: [] });
      provider = new BacklogHoverProvider(createMockParser(task));

      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nSee TASK-3.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 6), mockToken);
      expect(getHoverMarkdown(hover!)).not.toContain('Labels');
    });

    it('truncates long descriptions', async () => {
      const longDesc = 'A'.repeat(300);
      const task = makeTask({ id: 'TASK-3', title: 'Verbose', description: longDesc });
      provider = new BacklogHoverProvider(createMockParser(task));

      const doc = createMockTextDocument(
        '---\nid: TASK-10\n---\n\nSee TASK-3.',
        '/test/backlog/tasks/TASK-10 - Current.md'
      );

      const hover = await provider.provideHover(doc as never, new Position(4, 6), mockToken);
      expect(getHoverMarkdown(hover!)).toContain('...');
      // Should have at most 200 chars of description + "..."
      expect(getHoverMarkdown(hover!)).not.toContain('A'.repeat(201));
    });
  });
});
