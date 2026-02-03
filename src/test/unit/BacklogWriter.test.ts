import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BacklogWriter } from '../../core/BacklogWriter';
import { BacklogParser } from '../../core/BacklogParser';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    mkdirSync: vi.fn(),
  };
});

// Helper to mock readdirSync with string array (simulating withFileTypes: false)
function mockReaddirSync(files: string[]) {
  vi.mocked(fs.readdirSync).mockReturnValue(files as unknown as ReturnType<typeof fs.readdirSync>);
}

describe('BacklogWriter', () => {
  let writer: BacklogWriter;
  let mockParser: BacklogParser;

  beforeEach(() => {
    writer = new BacklogWriter();
    mockParser = new BacklogParser('/fake/backlog');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockReaddirSync([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateTaskStatus', () => {
    it('should update status in YAML frontmatter', async () => {
      const originalContent = `---
id: TASK-1
title: Test Task
status: To Do
priority: high
---

## Description
Test description
`;
      vi.mocked(fs.readFileSync).mockReturnValue(originalContent);
      mockReaddirSync(['task-1 - Test-Task.md']);

      await writer.updateTaskStatus('TASK-1', 'In Progress', mockParser);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;

      // Parse the written YAML to verify
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      expect(match).toBeTruthy();
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.status).toBe('In Progress');
    });

    it('should update status for all status types', async () => {
      const testCases = [
        { status: 'To Do' as const },
        { status: 'In Progress' as const },
        { status: 'Done' as const },
        { status: 'Draft' as const },
      ];

      for (const { status } of testCases) {
        vi.mocked(fs.writeFileSync).mockClear();

        const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
        vi.mocked(fs.readFileSync).mockReturnValue(content);
        mockReaddirSync(['task-1.md']);

        await writer.updateTaskStatus('TASK-1', status, mockParser);

        const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
        const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
        expect(frontmatter.status).toBe(status);
      }
    });
  });

  describe('toggleChecklistItem', () => {
    it('should toggle unchecked item to checked', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria
- [ ] #1 First item
- [ ] #2 Second item
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.toggleChecklistItem('TASK-1', 'acceptanceCriteria', 1, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('- [x] #1 First item');
      expect(writtenContent).toContain('- [ ] #2 Second item');
    });

    it('should toggle checked item to unchecked', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria
- [x] #1 First item
- [ ] #2 Second item
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.toggleChecklistItem('TASK-1', 'acceptanceCriteria', 1, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('- [ ] #1 First item');
    });
  });

  describe('updateTask', () => {
    it('should update priority', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
priority: low
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { priority: 'high' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.priority).toBe('high');
    });

    it('should update title', async () => {
      const content = `---
id: TASK-1
title: Old Title
status: To Do
---

# TASK-1 - Old Title
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { title: 'New Title' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.title).toBe('New Title');
    });

    it('should update labels array', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
labels: []
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { labels: ['bug', 'urgent'] }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.labels).toEqual(['bug', 'urgent']);
    });

    it('should preserve body content', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description
Important description text

## Acceptance Criteria
- [ ] #1 First criterion
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('## Description');
      expect(writtenContent).toContain('Important description text');
      expect(writtenContent).toContain('## Acceptance Criteria');
      expect(writtenContent).toContain('- [ ] #1 First criterion');
    });

    it('should update description with markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Old description
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
- [ ] #1 First criterion
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { description: 'New description text' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('<!-- SECTION:DESCRIPTION:BEGIN -->');
      expect(writtenContent).toContain('New description text');
      expect(writtenContent).toContain('<!-- SECTION:DESCRIPTION:END -->');
      expect(writtenContent).not.toContain('Old description');
      expect(writtenContent).toContain('## Acceptance Criteria');
    });
  });

  describe('createTask', () => {
    it('should create a new task file with auto-generated ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-1.md', 'task-5.md', 'task-3.md']);

      const result = await writer.createTask('/fake/backlog', {
        title: 'New Feature',
      });

      expect(result.id).toBe('TASK-6'); // Next after highest ID (5)
      expect(result.filePath).toContain('task-6 - New-Feature.md');
      expect(fs.writeFileSync).toHaveBeenCalled();

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      expect(match).toBeTruthy();
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.id).toBe('TASK-6');
      expect(frontmatter.title).toBe('New Feature');
      expect(frontmatter.status).toBe('To Do');
    });

    it('should create task with all optional fields', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      await writer.createTask('/fake/backlog', {
        title: 'Full Task',
        description: 'Task description',
        status: 'In Progress',
        priority: 'high',
        labels: ['bug', 'urgent'],
        milestone: 'v1.0',
      });

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.status).toBe('In Progress');
      expect(frontmatter.priority).toBe('high');
      expect(frontmatter.labels).toEqual(['bug', 'urgent']);
      expect(frontmatter.milestone).toBe('v1.0');
      expect(writtenContent).toContain('Task description');
    });

    it('should create tasks directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockReaddirSync([]);

      await writer.createTask('/fake/backlog', { title: 'Test' });

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('tasks'),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should sanitize special characters in filename', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createTask('/fake/backlog', {
        title: 'Fix: bug #123 (urgent!)',
      });

      expect(result.filePath).toContain('task-1 - Fix-bug-123-urgent.md');
    });
  });
});
