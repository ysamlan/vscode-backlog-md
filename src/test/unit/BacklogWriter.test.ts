import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BacklogWriter,
  computeContentHash,
  FileConflictError,
} from '../../core/BacklogWriter';
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
    renameSync: vi.fn(),
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
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: ISSUE-1');
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

  describe('Edge Cases: updateTask', () => {
    it('should throw error when task not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockReaddirSync([]);

      await expect(
        writer.updateTask('TASK-999', { status: 'Done' }, mockParser)
      ).rejects.toThrow('Task TASK-999 not found');
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
      await expect(
        writer.updateTask('TASK-1', { status: 'Done' }, mockParser)
      ).rejects.toThrow(); // Will throw because parser returns undefined for malformed YAML
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
});
