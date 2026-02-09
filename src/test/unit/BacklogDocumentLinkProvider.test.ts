import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacklogDocumentLinkProvider } from '../../language/BacklogDocumentLinkProvider';
import { createMockTextDocument } from '../mocks/vscode';
import type { BacklogParser } from '../../core/BacklogParser';
import type { CancellationToken } from 'vscode';
import type { Task } from '../../core/types';

function makeTask(id: string, title: string): Task {
  return {
    id,
    title,
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: `/test/backlog/tasks/${id} - ${title}.md`,
  };
}

function createMockParser(): BacklogParser {
  const tasks = [
    makeTask('TASK-1', 'First task'),
    makeTask('TASK-2', 'Second task'),
    makeTask('TASK-3', 'Third task'),
  ];

  return {
    getTasksFromFolder: vi.fn().mockImplementation(async (folder: string) => {
      if (folder === 'tasks') return tasks;
      return [];
    }),
  } as unknown as BacklogParser;
}

const mockToken = {} as CancellationToken;

describe('BacklogDocumentLinkProvider', () => {
  let parser: BacklogParser;
  let provider: BacklogDocumentLinkProvider;

  beforeEach(() => {
    parser = createMockParser();
    provider = new BacklogDocumentLinkProvider(parser);
  });

  it('creates links for known task IDs in document body', async () => {
    const doc = createMockTextDocument(
      '---\nid: TASK-10\n---\n\nSee TASK-1 and TASK-2 for details.',
      '/test/backlog/tasks/TASK-10 - Current.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);

    expect(links).toHaveLength(2);
    expect(links[0].tooltip).toBe('Open TASK-1');
    expect(links[1].tooltip).toBe('Open TASK-2');
  });

  it('excludes self-links (document own ID from frontmatter)', async () => {
    const doc = createMockTextDocument(
      '---\nid: TASK-1\n---\n\nThis is TASK-1 referencing TASK-2.',
      '/test/backlog/tasks/TASK-1 - First.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);

    expect(links).toHaveLength(1);
    expect(links[0].tooltip).toBe('Open TASK-2');
  });

  it('excludes self-links based on filename when frontmatter has no id', async () => {
    const doc = createMockTextDocument(
      '---\ntitle: First task\n---\n\nSee TASK-1 and TASK-3.',
      '/test/backlog/tasks/TASK-1 - First-task.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);

    expect(links).toHaveLength(1);
    expect(links[0].tooltip).toBe('Open TASK-3');
  });

  it('ignores unknown task IDs', async () => {
    const doc = createMockTextDocument(
      '---\nid: TASK-10\n---\n\nSee TASK-99 which does not exist.',
      '/test/backlog/tasks/TASK-10 - Current.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);

    expect(links).toHaveLength(0);
  });

  it('creates links with correct command URIs', async () => {
    const doc = createMockTextDocument(
      '---\nid: TASK-10\n---\n\nBlocked by TASK-2.',
      '/test/backlog/tasks/TASK-10 - Current.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);

    expect(links).toHaveLength(1);
    const target = links[0].target;
    expect(target).toBeDefined();
    // The URI should encode the command to open the task detail
    expect(target!.path).toContain('backlog.openTaskDetail');
    expect(target!.path).toContain('TASK-2');
  });

  it('handles subtask IDs with dot notation', async () => {
    const taskWithSubtask = makeTask('TASK-1.1', 'Subtask');
    (parser.getTasksFromFolder as ReturnType<typeof vi.fn>).mockImplementation(
      async (folder: string) => {
        if (folder === 'tasks') return [makeTask('TASK-1', 'First'), taskWithSubtask];
        return [];
      }
    );

    const doc = createMockTextDocument(
      '---\nid: TASK-10\n---\n\nSee TASK-1.1 for the subtask.',
      '/test/backlog/tasks/TASK-10 - Current.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);

    // Should find TASK-1.1 (and also TASK-1 if it's in the text — let's check)
    // "TASK-1.1" will match TASK-1.1 as the full pattern with dot notation
    // Note: The regex \b([A-Z]+-\d+(?:\.\d+)*)\b should match TASK-1.1
    const tooltips = links.map((l) => l.tooltip);
    expect(tooltips).toContain('Open TASK-1.1');
  });

  it('handles document with no task references', async () => {
    const doc = createMockTextDocument(
      '---\nid: TASK-10\n---\n\nJust some plain text with no references.',
      '/test/backlog/tasks/TASK-10 - Current.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);
    expect(links).toHaveLength(0);
  });

  it('scans all folders for known task IDs', async () => {
    const completedTask = makeTask('TASK-99', 'Completed task');
    (parser.getTasksFromFolder as ReturnType<typeof vi.fn>).mockImplementation(
      async (folder: string) => {
        if (folder === 'tasks') return [makeTask('TASK-1', 'First')];
        if (folder === 'completed') return [completedTask];
        return [];
      }
    );

    const doc = createMockTextDocument(
      '---\nid: TASK-10\n---\n\nSee TASK-99 completed.',
      '/test/backlog/tasks/TASK-10 - Current.md'
    );

    const links = await provider.provideDocumentLinks(doc as never, mockToken);
    expect(links).toHaveLength(1);
    expect(links[0].tooltip).toBe('Open TASK-99');
  });
});
