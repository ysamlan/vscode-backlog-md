import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BacklogWriter, computeContentHash, FileConflictError } from '../../core/BacklogWriter';
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
    statSync: vi.fn().mockReturnValue({ mtimeMs: 1000 }),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
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

    it('should update dependencies array', async () => {
      const content = `---
id: TASK-2
title: Test
status: To Do
dependencies: []
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-2.md']);

      await writer.updateTask('TASK-2', { dependencies: ['TASK-1', 'TASK-3'] }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.dependencies).toEqual(['TASK-1', 'TASK-3']);
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

    it('should handle task ID generation with gaps', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Files with gaps: 1, 3, 5, 10 - should create task-11
      mockReaddirSync(['task-1.md', 'task-3.md', 'task-5.md', 'task-10.md']);

      const result = await writer.createTask('/fake/backlog', {
        title: 'Gap Test',
      });

      expect(result.id).toBe('TASK-11');
    });

    it('should handle empty tasks directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createTask('/fake/backlog', {
        title: 'First Task',
      });

      expect(result.id).toBe('TASK-1');
    });

    it('should handle title with only special characters', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createTask('/fake/backlog', {
        title: '!@#$%^&*()',
      });

      // Should still create a file with sanitized (possibly empty) title portion
      expect(result.filePath).toContain('task-1');
    });

    it('should handle title with unicode characters', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      await writer.createTask('/fake/backlog', {
        title: '🚀 Feature with émojis and café',
      });

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('🚀 Feature with émojis and café');
    });

    it('should handle very long title by truncating filename', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const longTitle = 'A'.repeat(200);
      const result = await writer.createTask('/fake/backlog', {
        title: longTitle,
      });

      // Filename should be truncated but full title preserved in content
      expect(result.filePath.length).toBeLessThan(200);
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain(longTitle);
    });

    it('should use default TASK prefix when no parser provided', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createTask('/fake/backlog', {
        title: 'Test Task',
      });

      expect(result.id).toBe('TASK-1');
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: TASK-1');
    });

    it('should use custom task_prefix from config when parser provided', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      // Create a mock parser with custom config
      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ task_prefix: 'ISSUE' }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Test Issue' },
        mockParserWithConfig
      );

      expect(result.id).toBe('ISSUE-1');
      expect(result.filePath).toContain('issue-1 - Test-Issue.md');
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: ISSUE-1');
    });

    it('should return uppercase ID regardless of config prefix case', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ task_prefix: 'task' }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Test Task' },
        mockParserWithConfig
      );

      expect(result.id).toBe('TASK-1');
      expect(result.filePath).toContain('task-1 - Test-Task.md');
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: TASK-1');
    });

    it('should fallback to TASK prefix when config has no task_prefix', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      // Create a mock parser with config that lacks task_prefix
      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ project_name: 'My Project' }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Test Task' },
        mockParserWithConfig
      );

      expect(result.id).toBe('TASK-1');
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: TASK-1');
    });
  });

  describe('createTask with zero_padded_ids', () => {
    it('should zero-pad task ID when zero_padded_ids is 3', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ zero_padded_ids: 3 }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Padded Task' },
        mockParserWithConfig
      );

      expect(result.id).toBe('TASK-001');
      expect(result.filePath).toContain('task-001 - Padded-Task.md');
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: TASK-001');
    });

    it('should not pad when zero_padded_ids is undefined', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({}),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Unpadded Task' },
        mockParserWithConfig
      );

      expect(result.id).toBe('TASK-1');
      expect(result.filePath).toContain('task-1 - Unpadded-Task.md');
    });

    it('should pad with custom width (4)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-0009 - Existing.md']);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ zero_padded_ids: 4 }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Wide Pad' },
        mockParserWithConfig
      );

      expect(result.id).toBe('TASK-0010');
      expect(result.filePath).toContain('task-0010 - Wide-Pad.md');
    });

    it('should combine zero_padded_ids and custom task_prefix', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ task_prefix: 'PROJ', zero_padded_ids: 3 }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Project Task' },
        mockParserWithConfig
      );

      expect(result.id).toBe('PROJ-001');
      expect(result.filePath).toContain('proj-001 - Project-Task.md');
    });
  });

  describe('createTask with custom prefix file scanning', () => {
    it('should scan files with custom prefix for next ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['proj-1 - First.md', 'proj-3 - Third.md']);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ task_prefix: 'PROJ' }),
      } as unknown as BacklogParser;

      const result = await writer.createTask(
        '/fake/backlog',
        { title: 'Next Project' },
        mockParserWithConfig
      );

      expect(result.id).toBe('PROJ-4');
    });
  });

  describe('createSubtask with custom prefix', () => {
    it('should use prefix from parent ID in filename', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createSubtask('ISSUE-5', '/fake/backlog', mockParser);

      expect(result.id).toBe('ISSUE-5.1');
      expect(result.filePath).toContain('issue-5.1 - Untitled.md');
    });

    it('should scan with correct prefix pattern for existing subtasks', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['proj-3 - Parent.md', 'proj-3.1 - Sub-A.md', 'proj-3.2 - Sub-B.md']);

      const result = await writer.createSubtask('PROJ-3', '/fake/backlog', mockParser);

      expect(result.id).toBe('PROJ-3.3');
      expect(result.filePath).toContain('proj-3.3 - Untitled.md');
    });
  });

  describe('createTask with config defaults', () => {
    it('should use default_status from config when no explicit status', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ default_status: 'Backlog' }),
      } as unknown as BacklogParser;

      await writer.createTask('/fake/backlog', { title: 'Default Status' }, mockParserWithConfig);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.status).toBe('Backlog');
    });

    it('should use explicit status over config default_status', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ default_status: 'Backlog' }),
      } as unknown as BacklogParser;

      await writer.createTask(
        '/fake/backlog',
        { title: 'Explicit Status', status: 'In Progress' },
        mockParserWithConfig
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.status).toBe('In Progress');
    });

    it('should apply default_assignee from config', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ default_assignee: '@dev' }),
      } as unknown as BacklogParser;

      await writer.createTask('/fake/backlog', { title: 'With Assignee' }, mockParserWithConfig);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.assignee).toEqual(['@dev']);
    });

    it('should use explicit assignee over config default_assignee', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ default_assignee: '@dev' }),
      } as unknown as BacklogParser;

      await writer.createTask(
        '/fake/backlog',
        { title: 'Custom Assignee', assignee: ['@alice'] },
        mockParserWithConfig
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.assignee).toEqual(['@alice']);
    });

    it('should apply default_reporter from config', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({ default_reporter: '@pm' }),
      } as unknown as BacklogParser;

      await writer.createTask('/fake/backlog', { title: 'With Reporter' }, mockParserWithConfig);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.reporter).toBe('@pm');
    });

    it('should include DoD section when definition_of_done configured', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({
          definition_of_done: ['Tests pass', 'Code reviewed'],
        }),
      } as unknown as BacklogParser;

      await writer.createTask('/fake/backlog', { title: 'With DoD' }, mockParserWithConfig);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('## Definition of Done');
      expect(writtenContent).toContain('- [ ] #1 Tests pass');
      expect(writtenContent).toContain('- [ ] #2 Code reviewed');
    });

    it('should not include DoD section when definition_of_done not configured', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const mockParserWithConfig = {
        getConfig: vi.fn().mockResolvedValue({}),
      } as unknown as BacklogParser;

      await writer.createTask('/fake/backlog', { title: 'Without DoD' }, mockParserWithConfig);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).not.toContain('## Definition of Done');
    });
  });

  describe('promoteDraft with config defaults', () => {
    it('should use default_status from config when promoting', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockParserWithConfig = {
        getTask: vi.fn().mockResolvedValue({
          id: 'DRAFT-1',
          title: 'My Draft',
          status: 'Draft',
          folder: 'drafts',
          filePath: '/fake/backlog/drafts/draft-1 - My-Draft.md',
          description: '',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
        }),
        getConfig: vi.fn().mockResolvedValue({ default_status: 'Backlog' }),
        invalidateTaskCache: vi.fn(),
      } as unknown as BacklogParser;

      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: Draft
---
`);

      await writer.promoteDraft('DRAFT-1', mockParserWithConfig);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.status).toBe('Backlog');
    });
  });

  describe('Edge Cases: updateTask', () => {
    it('should throw error when task not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      await expect(writer.updateTask('TASK-999', { status: 'Done' }, mockParser)).rejects.toThrow(
        'Task TASK-999 not found'
      );
    });

    it('should preserve all fields when updating single field', async () => {
      const content = `---
id: TASK-1
title: Original Title
status: To Do
priority: high
labels:
  - bug
  - urgent
milestone: v1.0
assignee:
  - alice
---

## Description

Original description
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;

      expect(frontmatter.status).toBe('Done');
      expect(frontmatter.title).toBe('Original Title');
      expect(frontmatter.priority).toBe('high');
      expect(frontmatter.labels).toEqual(['bug', 'urgent']);
      expect(frontmatter.milestone).toBe('v1.0');
    });

    it('should add description markers when updating description without markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

Old description without markers

## Acceptance Criteria

- [ ] #1 Test
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { description: 'New description' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('<!-- SECTION:DESCRIPTION:BEGIN -->');
      expect(writtenContent).toContain('New description');
      expect(writtenContent).toContain('<!-- SECTION:DESCRIPTION:END -->');
    });

    it('should handle task file without frontmatter', async () => {
      const content = `# TASK-1 - No Frontmatter Task

## Description

Just a plain markdown file
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      // Parser can find task by extracting title from heading
      // The update should succeed and add frontmatter
      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Should write the updated content (frontmatter may be added)
      expect(fs.writeFileSync).toHaveBeenCalled();
      // The file content should still contain the description
      expect(writtenContent).toContain('Just a plain markdown file');
    });

    it('should handle file with malformed frontmatter', async () => {
      const content = `---
id: TASK-1
title: Test
status: {malformed: yaml:
---

## Description
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      // Should handle gracefully - parser might return undefined for malformed YAML
      await expect(writer.updateTask('TASK-1', { status: 'Done' }, mockParser)).rejects.toThrow(); // Will throw because parser returns undefined for malformed YAML
    });
  });

  describe('Edge Cases: toggleChecklistItem', () => {
    it('should handle toggle of non-existent item ID gracefully', async () => {
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

      // Toggle non-existent #999 - should not throw, just not change anything
      await writer.toggleChecklistItem('TASK-1', 'acceptanceCriteria', 999, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Original items should be unchanged
      expect(writtenContent).toContain('- [ ] #1 First item');
      expect(writtenContent).toContain('- [ ] #2 Second item');
    });

    it('should handle checklist item with special regex characters', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 Fix $100.00 bug (urgent!)
- [ ] #2 Test [link](url) and *bold*
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.toggleChecklistItem('TASK-1', 'acceptanceCriteria', 1, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('- [x] #1 Fix $100.00 bug (urgent!)');
    });

    it('should toggle definition of done items', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Definition of Done

- [ ] #1 Code reviewed
- [ ] #2 Tests passing
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.toggleChecklistItem('TASK-1', 'definitionOfDone', 2, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('- [ ] #1 Code reviewed');
      expect(writtenContent).toContain('- [x] #2 Tests passing');
    });

    it('should handle multiple items with same ID gracefully', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 First with ID 1
- [ ] #1 Second with same ID 1
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.toggleChecklistItem('TASK-1', 'acceptanceCriteria', 1, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Both should be toggled since they have the same ID
      expect(writtenContent).toContain('- [x] #1 First with ID 1');
      expect(writtenContent).toContain('- [x] #1 Second with same ID 1');
    });
  });

  describe('Edge Cases: Description Updates', () => {
    it('should handle updating description with nested markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Old content with <!-- nested comment -->
<!-- SECTION:DESCRIPTION:END -->
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { description: 'New clean description' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('New clean description');
      expect(writtenContent).not.toContain('Old content');
    });

    it('should handle description with code blocks containing markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Here is some code:
\`\`\`html
<!-- SECTION:DESCRIPTION:BEGIN -->
This is inside a code block
<!-- SECTION:DESCRIPTION:END -->
\`\`\`
<!-- SECTION:DESCRIPTION:END -->
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { description: 'Updated description' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Updated description');
    });

    it('should add description section when file has no description header', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 Test
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { description: 'Added description' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('## Description');
      expect(writtenContent).toContain('Added description');
    });

    it('should handle description with multiline content', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Old
<!-- SECTION:DESCRIPTION:END -->
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      const multilineDesc = `Line 1
Line 2
Line 3

With blank line above`;

      await writer.updateTask('TASK-1', { description: multilineDesc }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('Line 1');
      expect(writtenContent).toContain('Line 2');
      expect(writtenContent).toContain('With blank line above');
    });
  });

  describe('New Fields: references, documentation, type', () => {
    it('should update references array', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask(
        'TASK-1',
        { references: ['https://github.com/issue/1', 'docs/spec.md'] },
        mockParser
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.references).toEqual(['https://github.com/issue/1', 'docs/spec.md']);
    });

    it('should update documentation array', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask(
        'TASK-1',
        { documentation: ['https://docs.example.com', 'README.md'] },
        mockParser
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.documentation).toEqual(['https://docs.example.com', 'README.md']);
    });

    it('should update type field', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { type: 'feature' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.type).toBe('feature');
    });

    it('should preserve existing references when updating other fields', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
references:
  - existing-ref.md
documentation:
  - existing-doc.md
type: bug
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.references).toEqual(['existing-ref.md']);
      expect(frontmatter.documentation).toEqual(['existing-doc.md']);
      expect(frontmatter.type).toBe('bug');
    });

    it('should handle empty references array', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
references:
  - old-ref.md
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { references: [] }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.references).toEqual([]);
    });
  });

  describe('Canonical Format Compatibility', () => {
    it('should output arrays in inline bracket format', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
labels: [feature, ui]
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Should use inline format [item1, item2] not block format
      expect(writtenContent).toMatch(/labels: \[feature, ui\]/);
    });

    it('should preserve date strings without converting to timestamps', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
created: 2026-02-01
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Should NOT convert to ISO timestamp like 2026-02-01T00:00:00.000Z
      expect(writtenContent).not.toContain('T00:00:00');
      expect(writtenContent).toContain('created: 2026-02-01');
    });

    it('should have newline between closing --- and body content', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

# Test

Description here.
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Should have newline after closing ---, not ---# or ---\n#
      expect(writtenContent).toMatch(/---\n\n/);
      expect(writtenContent).not.toMatch(/---#/);
    });

    it('should format empty arrays as []', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
labels: []
dependencies: []
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('labels: []');
      expect(writtenContent).toContain('dependencies: []');
    });
  });

  describe('Edge Cases: YAML Serialization', () => {
    it('should handle empty arrays properly', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
labels: []
assignee: []
dependencies: []
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;

      expect(frontmatter.labels).toEqual([]);
      expect(frontmatter.assignee).toEqual([]);
    });

    it('should handle special characters in string fields', async () => {
      const content = `---
id: TASK-1
title: "Test: with special chars (urgent!) & more"
status: To Do
milestone: "v1.0-beta.1"
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Should preserve the special characters
      expect(writtenContent).toContain('Test: with special chars (urgent!) & more');
      expect(writtenContent).toContain('v1.0-beta.1');
    });
  });

  describe('Task Archiving', () => {
    it('should move task to completed/ folder', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-1 - Test-Task.md']);

      // Mock parser.getTask to return a task with file path
      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        status: 'Done',
        filePath: '/fake/backlog/tasks/task-1 - Test-Task.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      const result = await writer.completeTask('TASK-1', mockParser);

      expect(fs.renameSync).toHaveBeenCalledWith(
        '/fake/backlog/tasks/task-1 - Test-Task.md',
        '/fake/backlog/completed/task-1 - Test-Task.md'
      );
      expect(result).toBe('/fake/backlog/completed/task-1 - Test-Task.md');
    });

    it('should move task to archive/tasks/ folder', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-2 - Cancelled-Task.md']);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-2',
        title: 'Cancelled Task',
        status: 'To Do',
        filePath: '/fake/backlog/tasks/task-2 - Cancelled-Task.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      const result = await writer.archiveTask('TASK-2', mockParser);

      expect(fs.renameSync).toHaveBeenCalledWith(
        '/fake/backlog/tasks/task-2 - Cancelled-Task.md',
        '/fake/backlog/archive/tasks/task-2 - Cancelled-Task.md'
      );
      expect(result).toBe('/fake/backlog/archive/tasks/task-2 - Cancelled-Task.md');
    });

    it('should create destination folder if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockReaddirSync(['task-1 - Test-Task.md']);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-1',
        title: 'Test Task',
        status: 'Done',
        filePath: '/fake/backlog/tasks/task-1 - Test-Task.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      await writer.completeTask('TASK-1', mockParser);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/backlog/completed', { recursive: true });
    });

    it('should throw error for non-existent task', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue(undefined);

      await expect(writer.archiveTask('TASK-999', mockParser)).rejects.toThrow(
        'Task TASK-999 not found'
      );
    });

    it('should return new file path after move', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-5 - Feature.md']);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-5',
        title: 'Feature',
        status: 'Done',
        filePath: '/fake/backlog/tasks/task-5 - Feature.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      const newPath = await writer.completeTask('TASK-5', mockParser);

      expect(newPath).toBe('/fake/backlog/completed/task-5 - Feature.md');
    });

    it('should handle task file in nested backlog structure', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-1.md']);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-1',
        title: 'Test',
        status: 'Done',
        filePath: '/project/my-backlog/tasks/task-1.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      await writer.completeTask('TASK-1', mockParser);

      expect(fs.renameSync).toHaveBeenCalledWith(
        '/project/my-backlog/tasks/task-1.md',
        '/project/my-backlog/completed/task-1.md'
      );
    });
  });

  describe('promoteDraft', () => {
    it('should move file from drafts/ to tasks/ with new task ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'DRAFT-1',
        title: 'My Draft',
        status: 'Draft',
        folder: 'drafts',
        filePath: '/fake/backlog/drafts/draft-1 - My-Draft.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      vi.spyOn(mockParser, 'getConfig').mockResolvedValue({});

      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: Draft
---
`);

      const result = await writer.promoteDraft('DRAFT-1', mockParser);

      expect(fs.renameSync).toHaveBeenCalledWith(
        '/fake/backlog/drafts/draft-1 - My-Draft.md',
        '/fake/backlog/tasks/task-1 - My-Draft.md'
      );
      expect(result).toBe('TASK-1');
    });

    it('should update status from Draft to To Do and assign new task ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'DRAFT-1',
        title: 'My Draft',
        status: 'Draft',
        folder: 'drafts',
        filePath: '/fake/backlog/drafts/draft-1 - My-Draft.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      vi.spyOn(mockParser, 'getConfig').mockResolvedValue({});

      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: Draft
---
`);

      await writer.promoteDraft('DRAFT-1', mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.status).toBe('To Do');
      expect(frontmatter.id).toBe('TASK-1');
    });

    it('should throw error when task not found', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue(undefined);

      await expect(writer.promoteDraft('DRAFT-999', mockParser)).rejects.toThrow(
        'Task DRAFT-999 not found'
      );
    });

    it('should create tasks directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockReaddirSync([]);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'DRAFT-1',
        title: 'My Draft',
        status: 'Draft',
        folder: 'drafts',
        filePath: '/fake/backlog/drafts/draft-1 - My-Draft.md',
        description: '',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      vi.spyOn(mockParser, 'getConfig').mockResolvedValue({});

      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: Draft
---
`);

      await writer.promoteDraft('DRAFT-1', mockParser);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/backlog/tasks', { recursive: true });
    });
  });

  describe('createDraft', () => {
    it('should create a draft file in drafts/ folder', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createDraft('/fake/backlog');

      expect(result.id).toBe('DRAFT-1');
      expect(result.filePath).toContain('drafts');
      expect(result.filePath).toContain('draft-1 - Untitled.md');
      expect(fs.writeFileSync).toHaveBeenCalled();

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      expect(match).toBeTruthy();
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.id).toBe('DRAFT-1');
      expect(frontmatter.title).toBe('Untitled');
      expect(frontmatter.status).toBe('Draft');
    });

    it('should generate sequential draft IDs', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['draft-1 - Untitled.md', 'draft-3 - Some-Draft.md']);

      const result = await writer.createDraft('/fake/backlog');

      expect(result.id).toBe('DRAFT-4');
      expect(result.filePath).toContain('draft-4 - Untitled.md');
    });

    it('should return uppercase ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createDraft('/fake/backlog');

      expect(result.id).toBe('DRAFT-1');
      expect(result.id).toMatch(/^DRAFT-\d+$/);
    });

    it('should create drafts directory if missing', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockReaddirSync([]);

      await writer.createDraft('/fake/backlog');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('drafts'),
        expect.objectContaining({ recursive: true })
      );
    });
  });

  describe('createSubtask', () => {
    it('should create subtask with dot-notation ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createSubtask('TASK-2', '/fake/backlog', mockParser);

      expect(result.id).toBe('TASK-2.1');
      expect(result.filePath).toContain('task-2.1 - Untitled.md');
      expect(fs.writeFileSync).toHaveBeenCalled();

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      expect(match).toBeTruthy();
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.id).toBe('TASK-2.1');
      expect(frontmatter.title).toBe('Untitled');
      expect(frontmatter.status).toBe('To Do');
      expect(frontmatter.parent_task_id).toBe('TASK-2');
    });

    it('should find next sub-number with existing subtasks', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync(['task-2 - Parent.md', 'task-2.1 - First-Sub.md', 'task-2.3 - Third-Sub.md']);

      const result = await writer.createSubtask('TASK-2', '/fake/backlog', mockParser);

      // Should be 2.4 (next after max existing = 3), not 2.2 (filling gap)
      expect(result.id).toBe('TASK-2.4');
      expect(result.filePath).toContain('task-2.4 - Untitled.md');
    });

    it('should handle parent IDs with large numbers', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createSubtask('TASK-100', '/fake/backlog', mockParser);

      expect(result.id).toBe('TASK-100.1');
      expect(result.filePath).toContain('task-100.1 - Untitled.md');
    });

    it('should create tasks directory if missing', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockReaddirSync([]);

      await writer.createSubtask('TASK-1', '/fake/backlog', mockParser);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('tasks'),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should throw error if parent ID has no numeric part', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      await expect(writer.createSubtask('INVALID', '/fake/backlog', mockParser)).rejects.toThrow(
        'Cannot extract numeric ID'
      );
    });

    it('should use correct prefix from parent ID', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      const result = await writer.createSubtask('ISSUE-5', '/fake/backlog', mockParser);

      expect(result.id).toBe('ISSUE-5.1');
    });
  });

  describe('Conflict Detection', () => {
    describe('computeContentHash', () => {
      it('should return consistent hash for same content', () => {
        const content = 'test content';
        const hash1 = computeContentHash(content);
        const hash2 = computeContentHash(content);
        expect(hash1).toBe(hash2);
      });

      it('should return different hash for different content', () => {
        const hash1 = computeContentHash('content A');
        const hash2 = computeContentHash('content B');
        expect(hash1).not.toBe(hash2);
      });

      it('should return valid MD5 hash format', () => {
        const hash = computeContentHash('test');
        expect(hash).toMatch(/^[a-f0-9]{32}$/);
      });

      it('should handle empty content', () => {
        const hash = computeContentHash('');
        expect(hash).toMatch(/^[a-f0-9]{32}$/);
      });

      it('should handle unicode content', () => {
        const hash = computeContentHash('Hello World');
        expect(hash).toMatch(/^[a-f0-9]{32}$/);
      });
    });

    describe('updateTask with expectedHash', () => {
      it('should succeed when hash matches', async () => {
        const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
        vi.mocked(fs.readFileSync).mockReturnValue(content);
        mockReaddirSync(['task-1.md']);

        const expectedHash = computeContentHash(content);
        await writer.updateTask('TASK-1', { status: 'Done' }, mockParser, expectedHash);

        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('should throw FileConflictError when hash does not match', async () => {
        const originalContent = `---
id: TASK-1
title: Test
status: To Do
---
`;
        const modifiedContent = `---
id: TASK-1
title: Test Modified Externally
status: To Do
---
`;
        vi.mocked(fs.readFileSync).mockReturnValue(modifiedContent);
        mockReaddirSync(['task-1.md']);

        const originalHash = computeContentHash(originalContent);

        await expect(
          writer.updateTask('TASK-1', { status: 'Done' }, mockParser, originalHash)
        ).rejects.toThrow(FileConflictError);
      });

      it('should include current content in FileConflictError', async () => {
        const originalContent = `---
id: TASK-1
title: Original
status: To Do
---
`;
        const modifiedContent = `---
id: TASK-1
title: Modified
status: To Do
---
`;
        vi.mocked(fs.readFileSync).mockReturnValue(modifiedContent);
        mockReaddirSync(['task-1.md']);

        const originalHash = computeContentHash(originalContent);

        try {
          await writer.updateTask('TASK-1', { status: 'Done' }, mockParser, originalHash);
          expect.fail('Should have thrown FileConflictError');
        } catch (error) {
          expect(error).toBeInstanceOf(FileConflictError);
          expect((error as FileConflictError).currentContent).toBe(modifiedContent);
          expect((error as FileConflictError).code).toBe('CONFLICT');
        }
      });

      it('should skip conflict check when expectedHash is not provided', async () => {
        const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
        vi.mocked(fs.readFileSync).mockReturnValue(content);
        mockReaddirSync(['task-1.md']);

        // No expectedHash provided - should succeed regardless
        await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('should detect conflict for whitespace-only changes', async () => {
        const originalContent = `---
id: TASK-1
title: Test
status: To Do
---
`;
        // Added extra newline at the end - this is a real difference
        const modifiedContent = `---
id: TASK-1
title: Test
status: To Do
---

`;
        vi.mocked(fs.readFileSync).mockReturnValue(modifiedContent);
        mockReaddirSync(['task-1.md']);

        const originalHash = computeContentHash(originalContent);

        await expect(
          writer.updateTask('TASK-1', { status: 'Done' }, mockParser, originalHash)
        ).rejects.toThrow(FileConflictError);
      });
    });
  });

  describe('restoreArchivedTask', () => {
    it('should move task from archive/tasks/ to tasks/', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-5',
        title: 'Archived Task',
        status: 'Done' as const,
        folder: 'archive' as const,
        filePath: '/fake/backlog/archive/tasks/task-5 - Archived-Task.md',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      const result = await writer.restoreArchivedTask('TASK-5', mockParser);

      expect(fs.renameSync).toHaveBeenCalledWith(
        '/fake/backlog/archive/tasks/task-5 - Archived-Task.md',
        '/fake/backlog/tasks/task-5 - Archived-Task.md'
      );
      expect(result).toBe('/fake/backlog/tasks/task-5 - Archived-Task.md');
    });

    it('should throw when task is not found', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue(undefined);

      await expect(writer.restoreArchivedTask('TASK-999', mockParser)).rejects.toThrow(
        'Task TASK-999 not found'
      );
    });
  });

  describe('deleteTask', () => {
    it('should permanently delete the task file', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-5',
        title: 'Task to Delete',
        status: 'Done' as const,
        folder: 'archive' as const,
        filePath: '/fake/backlog/archive/tasks/task-5 - Task-to-Delete.md',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      await writer.deleteTask('TASK-5', mockParser);

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        '/fake/backlog/archive/tasks/task-5 - Task-to-Delete.md'
      );
    });

    it('should throw when task is not found', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue(undefined);

      await expect(writer.deleteTask('TASK-999', mockParser)).rejects.toThrow(
        'Task TASK-999 not found'
      );
    });
  });

  describe('Round-trip: parse -> write -> parse preserves fields', () => {
    /**
     * Helper that simulates a round-trip:
     * 1. Parse original content with BacklogParser
     * 2. Write via BacklogWriter.updateTask (making a trivial status change)
     * 3. Parse the written content again
     * 4. Return both parsed tasks for comparison
     */
    async function roundTrip(originalContent: string) {
      const parser = new BacklogParser('/fake/backlog');

      // Step 1: parse original
      const originalTask = parser.parseTaskContent(
        originalContent,
        '/fake/backlog/tasks/task-1.md'
      );
      expect(originalTask).toBeDefined();

      // Step 2: write via updateTask
      vi.mocked(fs.readFileSync).mockReturnValue(originalContent);
      mockReaddirSync(['task-1.md']);
      await writer.updateTask('TASK-1', { status: originalTask!.status }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;

      // Step 3: parse written content
      const roundTrippedTask = parser.parseTaskContent(
        writtenContent,
        '/fake/backlog/tasks/task-1.md'
      );
      expect(roundTrippedTask).toBeDefined();

      return { original: originalTask!, roundTripped: roundTrippedTask!, writtenContent };
    }

    it('should preserve assignee array with @-prefixed values', async () => {
      const content = `---
id: TASK-1
title: Assignee Test
status: To Do
assignee: ["@alice", "@bob"]
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.assignee).toEqual(original.assignee);
      expect(roundTripped.assignee).toEqual(['@alice', '@bob']);
    });

    it('should preserve single assignee as array', async () => {
      const content = `---
id: TASK-1
title: Single Assignee
status: To Do
assignee: "@charlie"
---
`;
      const { roundTripped } = await roundTrip(content);
      expect(roundTripped.assignee).toEqual(['@charlie']);
    });

    it('should preserve references array', async () => {
      const content = `---
id: TASK-1
title: References Test
status: To Do
references: ["https://github.com/org/repo/issues/42", "docs/spec.md"]
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.references).toEqual(original.references);
    });

    it('should preserve documentation array', async () => {
      const content = `---
id: TASK-1
title: Documentation Test
status: To Do
documentation: ["https://docs.example.com/api", "README.md"]
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.documentation).toEqual(original.documentation);
    });

    it('should preserve type field', async () => {
      const content = `---
id: TASK-1
title: Type Test
status: To Do
type: feature
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.type).toBe(original.type);
      expect(roundTripped.type).toBe('feature');
    });

    it('should preserve milestone field', async () => {
      const content = `---
id: TASK-1
title: Milestone Test
status: To Do
milestone: v2.0
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.milestone).toBe(original.milestone);
      expect(roundTripped.milestone).toBe('v2.0');
    });

    it('should preserve ordinal field', async () => {
      const content = `---
id: TASK-1
title: Ordinal Test
status: To Do
ordinal: 42.5
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.ordinal).toBe(original.ordinal);
      expect(roundTripped.ordinal).toBe(42.5);
    });

    it('should preserve subtasks array', async () => {
      const content = `---
id: TASK-1
title: Parent with Subtasks
status: In Progress
subtasks: [TASK-1.1, TASK-1.2, TASK-1.3]
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.subtasks).toEqual(original.subtasks);
      expect(roundTripped.subtasks).toEqual(['TASK-1.1', 'TASK-1.2', 'TASK-1.3']);
    });

    it('should preserve parent_task_id field', async () => {
      const content = `---
id: TASK-1
title: Subtask
status: To Do
parent_task_id: TASK-5
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.parentTaskId).toBe(original.parentTaskId);
      expect(roundTripped.parentTaskId).toBe('TASK-5');
    });

    it('should preserve created_date field', async () => {
      const content = `---
id: TASK-1
title: Date Test
status: To Do
created_date: 2026-01-15
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.createdAt).toBe(original.createdAt);
      expect(roundTripped.createdAt).toBe('2026-01-15');
    });

    it('should preserve updated_date field', async () => {
      const content = `---
id: TASK-1
title: Updated Date Test
status: To Do
created_date: 2026-01-15
updated_date: 2026-01-20
---
`;
      // Note: updateTask always sets updated_date to today, so we check
      // that it survives as a valid date string
      const { roundTripped } = await roundTrip(content);
      expect(roundTripped.updatedAt).toBeDefined();
      expect(roundTripped.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should preserve reporter field', async () => {
      const content = `---
id: TASK-1
title: Reporter Test
status: To Do
reporter: "@pm-lead"
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.reporter).toBe(original.reporter);
      expect(roundTripped.reporter).toBe('@pm-lead');
    });

    it('should preserve labels array', async () => {
      const content = `---
id: TASK-1
title: Labels Test
status: To Do
labels: [bug, urgent, "feature/new-ui"]
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.labels).toEqual(original.labels);
    });

    it('should preserve dependencies array', async () => {
      const content = `---
id: TASK-1
title: Dependencies Test
status: To Do
dependencies: [TASK-2, TASK-3]
---
`;
      const { original, roundTripped } = await roundTrip(content);
      expect(roundTripped.dependencies).toEqual(original.dependencies);
    });

    it('should preserve all fields together on round-trip', async () => {
      const content = `---
id: TASK-1
title: Full Field Test
status: In Progress
priority: high
milestone: v2.0
labels: [bug, critical]
assignee: ["@alice", "@bob"]
reporter: "@pm"
created_date: 2026-01-10
updated_date: 2026-01-15
dependencies: [TASK-2]
references: ["https://github.com/issue/1"]
documentation: ["docs/design.md"]
parent_task_id: TASK-0
subtasks: [TASK-1.1, TASK-1.2]
ordinal: 3.5
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full test description
<!-- SECTION:DESCRIPTION:END -->
`;
      const { original, roundTripped } = await roundTrip(content);

      expect(roundTripped.id).toBe(original.id);
      expect(roundTripped.title).toBe(original.title);
      expect(roundTripped.status).toBe(original.status);
      expect(roundTripped.priority).toBe(original.priority);
      expect(roundTripped.milestone).toBe(original.milestone);
      expect(roundTripped.labels).toEqual(original.labels);
      expect(roundTripped.assignee).toEqual(original.assignee);
      expect(roundTripped.reporter).toBe(original.reporter);
      expect(roundTripped.createdAt).toBe(original.createdAt);
      expect(roundTripped.dependencies).toEqual(original.dependencies);
      expect(roundTripped.references).toEqual(original.references);
      expect(roundTripped.documentation).toEqual(original.documentation);
      expect(roundTripped.parentTaskId).toBe(original.parentTaskId);
      expect(roundTripped.subtasks).toEqual(original.subtasks);
      expect(roundTripped.ordinal).toBe(original.ordinal);
      expect(roundTripped.type).toBe(original.type);
      expect(roundTripped.description).toBe(original.description);
    });

    it('should preserve empty arrays on round-trip', async () => {
      const content = `---
id: TASK-1
title: Empty Arrays Test
status: To Do
labels: []
assignee: []
dependencies: []
references: []
documentation: []
---
`;
      const { roundTripped } = await roundTrip(content);
      expect(roundTripped.labels).toEqual([]);
      expect(roundTripped.assignee).toEqual([]);
      expect(roundTripped.dependencies).toEqual([]);
      expect(roundTripped.references).toEqual([]);
      expect(roundTripped.documentation).toEqual([]);
    });

    it('should preserve body sections on round-trip', async () => {
      const content = `---
id: TASK-1
title: Body Sections Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The description content.
<!-- SECTION:DESCRIPTION:END -->

## Plan

1. Step one
2. Step two

## Implementation Notes

Some notes here.

## Final Summary

Summary text.

## Acceptance Criteria

- [ ] #1 First criterion
- [x] #2 Second criterion done

## Definition of Done

- [ ] #1 Code reviewed
- [x] #2 Tests passing
`;
      const { original, roundTripped } = await roundTrip(content);

      expect(roundTripped.description).toBe(original.description);
      expect(roundTripped.plan).toBe(original.plan);
      expect(roundTripped.implementationNotes).toBe(original.implementationNotes);
      expect(roundTripped.finalSummary).toBe(original.finalSummary);
      expect(roundTripped.acceptanceCriteria).toEqual(original.acceptanceCriteria);
      expect(roundTripped.definitionOfDone).toEqual(original.definitionOfDone);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache after updateTask', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      const invalidateSpy = vi.spyOn(mockParser, 'invalidateTaskCache');

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      expect(invalidateSpy).toHaveBeenCalledWith(expect.stringContaining('task-1.md'));
    });

    it('should invalidate cache after deleteTask', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-1',
        title: 'Test',
        status: 'Done',
        filePath: '/fake/backlog/tasks/task-1.md',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      const invalidateSpy = vi.spyOn(mockParser, 'invalidateTaskCache');

      await writer.deleteTask('TASK-1', mockParser);

      expect(invalidateSpy).toHaveBeenCalledWith('/fake/backlog/tasks/task-1.md');
    });

    it('should invalidate cache for both old and new paths after completeTask', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-1',
        title: 'Test',
        status: 'Done',
        filePath: '/fake/backlog/tasks/task-1.md',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      const invalidateSpy = vi.spyOn(mockParser, 'invalidateTaskCache');

      await writer.completeTask('TASK-1', mockParser);

      expect(invalidateSpy).toHaveBeenCalledWith('/fake/backlog/tasks/task-1.md');
      expect(invalidateSpy).toHaveBeenCalledWith('/fake/backlog/completed/task-1.md');
    });

    it('should invalidate cache for both old and new paths after promoteDraft', async () => {
      mockReaddirSync([]);

      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'DRAFT-1',
        title: 'My Draft',
        status: 'Draft',
        folder: 'drafts',
        filePath: '/fake/backlog/drafts/draft-1 - My-Draft.md',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
      });

      vi.spyOn(mockParser, 'getConfig').mockResolvedValue({});

      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: Draft
---
`);

      const invalidateSpy = vi.spyOn(mockParser, 'invalidateTaskCache');

      await writer.promoteDraft('DRAFT-1', mockParser);

      expect(invalidateSpy).toHaveBeenCalledWith('/fake/backlog/drafts/draft-1 - My-Draft.md');
      expect(invalidateSpy).toHaveBeenCalledWith('/fake/backlog/tasks/task-1 - My-Draft.md');
    });

    it('should invalidate cache after toggleChecklistItem', async () => {
      vi.spyOn(mockParser, 'getTask').mockResolvedValue({
        id: 'TASK-1',
        title: 'Test',
        status: 'To Do',
        filePath: '/fake/backlog/tasks/task-1.md',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [{ id: 1, text: 'Test criterion', checked: false }],
        definitionOfDone: [],
      });

      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria
- [ ] #1 Test criterion
`);

      const invalidateSpy = vi.spyOn(mockParser, 'invalidateTaskCache');

      await writer.toggleChecklistItem('TASK-1', 'acceptanceCriteria', 1, mockParser);

      expect(invalidateSpy).toHaveBeenCalledWith('/fake/backlog/tasks/task-1.md');
    });
  });

  describe('updateTask: checklist text updates', () => {
    it('should update acceptance criteria content between markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Old criterion
- [x] #2 Old done criterion
<!-- AC:END -->
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask(
        'TASK-1',
        {
          acceptanceCriteria: '- [ ] #1 New first\n- [ ] #2 New second\n- [ ] #3 Added third',
        } as never,
        mockParser
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('<!-- AC:BEGIN -->');
      expect(writtenContent).toContain('- [ ] #1 New first');
      expect(writtenContent).toContain('- [ ] #2 New second');
      expect(writtenContent).toContain('- [ ] #3 Added third');
      expect(writtenContent).toContain('<!-- AC:END -->');
      expect(writtenContent).not.toContain('Old criterion');
    });

    it('should update definition of done content between markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Old DoD item
<!-- DOD:END -->
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask(
        'TASK-1',
        { definitionOfDone: '- [x] #1 Code reviewed\n- [ ] #2 Tests pass' } as never,
        mockParser
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('<!-- DOD:BEGIN -->');
      expect(writtenContent).toContain('- [x] #1 Code reviewed');
      expect(writtenContent).toContain('- [ ] #2 Tests pass');
      expect(writtenContent).toContain('<!-- DOD:END -->');
      expect(writtenContent).not.toContain('Old DoD item');
    });

    it('should add AC section with markers when none exists', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

Some description
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask(
        'TASK-1',
        { acceptanceCriteria: '- [ ] #1 New criterion' } as never,
        mockParser
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('## Acceptance Criteria');
      expect(writtenContent).toContain('<!-- AC:BEGIN -->');
      expect(writtenContent).toContain('- [ ] #1 New criterion');
      expect(writtenContent).toContain('<!-- AC:END -->');
    });

    it('should add markers to existing AC section header without markers', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 Old item without markers

## Definition of Done
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask(
        'TASK-1',
        { acceptanceCriteria: '- [ ] #1 Updated item' } as never,
        mockParser
      );

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('<!-- AC:BEGIN -->');
      expect(writtenContent).toContain('- [ ] #1 Updated item');
      expect(writtenContent).toContain('<!-- AC:END -->');
      expect(writtenContent).toContain('## Definition of Done');
    });
  });

  describe('updateTask: reporter field', () => {
    it('should update reporter field', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { reporter: '@new-reporter' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.reporter).toBe('@new-reporter');
    });

    it('should preserve existing reporter when updating other fields', async () => {
      const content = `---
id: TASK-1
title: Test
status: To Do
reporter: "@original-reporter"
---
`;
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      mockReaddirSync(['task-1.md']);

      await writer.updateTask('TASK-1', { status: 'Done' }, mockParser);

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const match = writtenContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = yaml.load(match![1]) as Record<string, unknown>;
      expect(frontmatter.reporter).toBe('@original-reporter');
    });
  });
});
