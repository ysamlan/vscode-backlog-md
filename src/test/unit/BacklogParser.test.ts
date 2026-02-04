import { describe, it, expect, vi, afterEach } from 'vitest';
import { BacklogParser } from '../../core/BacklogParser';
import * as fs from 'fs';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

describe('BacklogParser', () => {
  describe('parseTaskContent', () => {
    it('should parse a task with YAML frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test Task Title
status: To Do
priority: high
labels:
  - bug
  - urgent
milestone: MVP Release
assignee: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This is the task description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First criterion
- [x] #2 Second criterion completed
<!-- AC:END -->
`;

      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');

      expect(task).toBeDefined();
      expect(task?.id).toBe('TASK-1');
      expect(task?.title).toBe('Test Task Title');
      expect(task?.status).toBe('To Do');
      expect(task?.priority).toBe('high');
      expect(task?.labels).toEqual(['bug', 'urgent']);
      expect(task?.milestone).toBe('MVP Release');
      expect(task?.description).toBe('This is the task description.');
      expect(task?.acceptanceCriteria).toHaveLength(2);
      expect(task?.acceptanceCriteria[0].checked).toBe(false);
      expect(task?.acceptanceCriteria[1].checked).toBe(true);
    });

    it('should parse status values correctly', () => {
      const parser = new BacklogParser('/fake/path');

      const testCases = [
        { status: 'To Do', expected: 'To Do' },
        { status: 'In Progress', expected: 'In Progress' },
        { status: 'Done', expected: 'Done' },
        { status: 'Draft', expected: 'Draft' },
      ];

      for (const { status, expected } of testCases) {
        const content = `---
id: TASK-1
title: Test
status: ${status}
---
`;
        const task = parser.parseTaskContent(content, '/fake/task-1.md');
        expect(task?.status).toBe(expected);
      }
    });

    it('should parse multiple assignees as multi-line array', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
assignee:
  - alice
  - bob
  - charlie
---
`;

      const task = parser.parseTaskContent(content, '/fake/task-1.md');
      expect(task?.assignee).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should handle minimal task with just required fields', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Minimal Task
status: To Do
---
`;

      const task = parser.parseTaskContent(content, '/fake/task-1.md');

      expect(task).toBeDefined();
      expect(task?.title).toBe('Minimal Task');
      expect(task?.description).toBeUndefined();
      expect(task?.labels).toEqual([]);
      expect(task?.acceptanceCriteria).toEqual([]);
    });

    it('should parse definition of done items', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Definition of Done

- [ ] #1 Code reviewed
- [ ] #2 Tests passing
- [x] #3 Documentation updated
`;

      const task = parser.parseTaskContent(content, '/fake/task-1.md');

      expect(task?.definitionOfDone).toHaveLength(3);
      expect(task?.definitionOfDone[2].checked).toBe(true);
    });

    it('should parse inline array syntax for labels', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test with inline labels
status: To Do
labels: []
dependencies: []
---
`;

      const task = parser.parseTaskContent(content, '/fake/task-1.md');
      expect(task?.labels).toEqual([]);
      expect(task?.dependencies).toEqual([]);
    });

    it('should extract task ID from filename if not in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: Test without ID
status: To Do
---
`;

      const task = parser.parseTaskContent(content, '/fake/path/task-42 - Some-Task-Name.md');
      expect(task?.id).toBe('TASK-42');
    });
  });

  describe('getConfig', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should parse config.yml and return BacklogConfig', async () => {
      const configContent = `
project_name: "Test Project"
statuses: ["To Do", "In Progress", "Review", "Done"]
labels: ["bug", "feature"]
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.project_name).toBe('Test Project');
      expect(config.statuses).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
      expect(config.labels).toEqual(['bug', 'feature']);
    });

    it('should return empty config when no config file exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config).toEqual({});
    });

    it('should handle malformed YAML gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: content: [');

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config).toEqual({});
    });
  });

  describe('getStatuses', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return statuses from config', async () => {
      const configContent = `statuses: ["Backlog", "Active", "Complete"]`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const statuses = await parser.getStatuses();

      expect(statuses).toEqual(['Backlog', 'Active', 'Complete']);
    });

    it('should return default statuses when config has none', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const parser = new BacklogParser('/fake/backlog');
      const statuses = await parser.getStatuses();

      expect(statuses).toEqual(['To Do', 'In Progress', 'Done']);
    });
  });

  describe('Cross-Branch Config Options', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should parse check_active_branches option from config', async () => {
      const configContent = `
check_active_branches: true
active_branch_days: 30
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.check_active_branches).toBe(true);
      expect(config.active_branch_days).toBe(30);
    });

    it('should parse remote_operations option from config', async () => {
      const configContent = `
remote_operations: false
check_active_branches: false
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.remote_operations).toBe(false);
      expect(config.check_active_branches).toBe(false);
    });

    it('should parse task_resolution_strategy option from config', async () => {
      const configContent = `
task_resolution_strategy: most_progressed
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.task_resolution_strategy).toBe('most_progressed');
    });

    it('should parse zero_padded_ids option from config', async () => {
      const configContent = `
zero_padded_ids: true
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.zero_padded_ids).toBe(true);
    });

    it('should handle config with all cross-branch options', async () => {
      const configContent = `
project_name: "Test Project"
check_active_branches: true
remote_operations: true
active_branch_days: 14
task_resolution_strategy: most_recent
zero_padded_ids: false
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.project_name).toBe('Test Project');
      expect(config.check_active_branches).toBe(true);
      expect(config.remote_operations).toBe(true);
      expect(config.active_branch_days).toBe(14);
      expect(config.task_resolution_strategy).toBe('most_recent');
      expect(config.zero_padded_ids).toBe(false);
    });

    it('should return undefined for missing cross-branch config options', async () => {
      const configContent = `
project_name: "Simple Project"
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.check_active_branches).toBeUndefined();
      expect(config.remote_operations).toBeUndefined();
      expect(config.active_branch_days).toBeUndefined();
      expect(config.task_resolution_strategy).toBeUndefined();
    });
  });

  describe('Edge Cases: Empty/Malformed Files', () => {
    it('should return undefined for empty file', () => {
      const parser = new BacklogParser('/fake/path');
      const task = parser.parseTaskContent('', '/fake/path/task-1.md');
      expect(task).toBeUndefined();
    });

    it('should return undefined for file with only whitespace', () => {
      const parser = new BacklogParser('/fake/path');
      const task = parser.parseTaskContent('   \n\n  \t  \n', '/fake/path/task-1.md');
      expect(task).toBeUndefined();
    });

    it('should return undefined for file with empty frontmatter (---\\n---)', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      // No title, so should be undefined
      expect(task).toBeUndefined();
    });

    it('should handle frontmatter with missing closing delimiter gracefully', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Missing closing delimiter
status: To Do
`;
      // Parser should handle this gracefully - it may try to parse the whole file as frontmatter
      // Behavior depends on implementation - either finds title or returns undefined
      // The important thing is it doesn't crash
      expect(() => parser.parseTaskContent(content, '/fake/path/task-1.md')).not.toThrow();
    });

    it('should handle malformed YAML in frontmatter gracefully', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: [unclosed bracket
labels: {bad: yaml:
---

# Task Title
`;
      // Should not throw, should fall back to extracting ID from filename
      expect(() => parser.parseTaskContent(content, '/fake/path/task-1.md')).not.toThrow();
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      // Should at least extract ID from filename and title from heading
      expect(task?.id).toBe('TASK-1');
    });

    it('should handle file with only frontmatter delimiters and no content', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
---`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task).toBeUndefined();
    });
  });

  describe('Edge Cases: Unicode and Special Characters', () => {
    it('should parse task with emoji in title', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: "🚀 Feature launch with 🎉 celebration"
status: To Do
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.title).toBe('🚀 Feature launch with 🎉 celebration');
    });

    it('should parse task with multi-byte characters in description', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: International Task
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Café in München, 日本語テスト, Привет мир, مرحبا بالعالم
<!-- SECTION:DESCRIPTION:END -->
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toContain('Café');
      expect(task?.description).toContain('München');
      expect(task?.description).toContain('日本語テスト');
    });

    it('should parse labels with special characters', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
labels:
  - "feature/new-ui"
  - "bug:critical"
  - "v2.0"
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.labels).toEqual(['feature/new-ui', 'bug:critical', 'v2.0']);
    });

    it('should handle description with special regex characters', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Regex Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test regex chars: $100.00 ^start end$ *bold* [link](url) {braces} (parens) \\backslash
<!-- SECTION:DESCRIPTION:END -->
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toContain('$100.00');
      expect(task?.description).toContain('^start');
      expect(task?.description).toContain('\\backslash');
    });

    it('should handle CRLF line endings', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---\r\nid: TASK-1\r\ntitle: CRLF Test\r\nstatus: To Do\r\n---\r\n\r\n## Description\r\n\r\n<!-- SECTION:DESCRIPTION:BEGIN -->\r\nWindows line endings\r\n<!-- SECTION:DESCRIPTION:END -->\r\n`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.title).toBe('CRLF Test');
    });
  });

  describe('Edge Cases: Checklist Parsing', () => {
    it('should handle malformed checklist item without space after bracket', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 Valid item
- [x]#2 Missing space after bracket
- [ ]No id item
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      // Should at least parse the valid item
      expect(task?.acceptanceCriteria.length).toBeGreaterThanOrEqual(1);
      expect(task?.acceptanceCriteria[0].text).toBe('Valid item');
    });

    it('should parse checklist item with special characters in text', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 Fix: bug #123 (urgent!) [link](url) @mention
- [x] #2 Test \`code\` and **bold**
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.acceptanceCriteria).toHaveLength(2);
      expect(task?.acceptanceCriteria[0].text).toBe('Fix: bug #123 (urgent!) [link](url) @mention');
      expect(task?.acceptanceCriteria[1].text).toContain('code');
    });

    it('should handle very long checklist item text', () => {
      const parser = new BacklogParser('/fake/path');
      const longText = 'A'.repeat(500);
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 ${longText}
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.acceptanceCriteria[0].text).toBe(longText);
    });

    it('should parse checklist items without #id prefix', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] Item without id prefix
- [x] Another item without id
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.acceptanceCriteria).toHaveLength(2);
      expect(task?.acceptanceCriteria[0].text).toBe('Item without id prefix');
      expect(task?.acceptanceCriteria[1].checked).toBe(true);
    });

    it('should handle uppercase X in checkbox', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [X] #1 Uppercase X checked
- [x] #2 Lowercase x checked
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.acceptanceCriteria[0].checked).toBe(true);
      expect(task?.acceptanceCriteria[1].checked).toBe(true);
    });

    it('should parse mixed acceptance criteria and definition of done', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Acceptance Criteria

- [ ] #1 AC item 1
- [x] #2 AC item 2

## Definition of Done

- [ ] #1 DoD item 1
- [x] #2 DoD item 2
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.acceptanceCriteria).toHaveLength(2);
      expect(task?.definitionOfDone).toHaveLength(2);
      expect(task?.acceptanceCriteria[0].text).toBe('AC item 1');
      expect(task?.definitionOfDone[0].text).toBe('DoD item 1');
    });
  });

  describe('Edge Cases: Field Type Validation', () => {
    it('should handle labels as single string instead of array', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
labels: "single-label"
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.labels).toEqual(['single-label']);
    });

    it('should handle labels: null gracefully', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
labels: null
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.labels).toEqual([]);
    });

    it('should handle empty string title', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: ""
status: To Do
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      // Empty title means task is invalid
      expect(task).toBeUndefined();
    });

    it('should handle very long title', () => {
      const parser = new BacklogParser('/fake/path');
      const longTitle = 'Very Long Task Title '.repeat(30);
      const content = `---
id: TASK-1
title: "${longTitle}"
status: To Do
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.title).toBe(longTitle);
    });

    it('should handle assignee as single string instead of array', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
assignee: single-person
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.assignee).toEqual(['single-person']);
    });

    it('should handle dependencies as single string instead of array', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
dependencies: TASK-2
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.dependencies).toEqual(['TASK-2']);
    });

    it('should parse numeric ID in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: 123
title: Numeric ID
status: To Do
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-123.md');
      // ID should be converted to uppercase string
      expect(task?.id).toBe('123');
    });

    it('should handle status with unicode symbol prefix', () => {
      const parser = new BacklogParser('/fake/path');
      const testCases = [
        { status: '○ To Do', expected: 'To Do' },
        { status: '◒ In Progress', expected: 'In Progress' },
        { status: '● Done', expected: 'Done' },
      ];

      for (const { status, expected } of testCases) {
        const content = `---
id: TASK-1
title: Test
status: ${status}
---
`;
        const task = parser.parseTaskContent(content, '/fake/task-1.md');
        expect(task?.status).toBe(expected);
      }
    });
  });

  describe('New Fields: references, documentation, type, plan', () => {
    it('should parse references array from frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test with references
status: To Do
references:
  - https://github.com/org/repo/issues/123
  - docs/design.md
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.references).toEqual([
        'https://github.com/org/repo/issues/123',
        'docs/design.md',
      ]);
    });

    it('should parse documentation array from frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test with documentation
status: To Do
documentation:
  - https://docs.example.com/api
  - README.md
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.documentation).toEqual(['https://docs.example.com/api', 'README.md']);
    });

    it('should parse type field from frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test with type
status: To Do
type: feature
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.type).toBe('feature');
    });

    it('should parse ## Plan section content', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test with plan
status: To Do
---

## Plan

1. First step
2. Second step
3. Third step

## Acceptance Criteria

- [ ] #1 Test
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.plan).toBe('1. First step\n2. Second step\n3. Third step');
    });

    it('should parse ## Implementation Plan section as plan', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test with implementation plan
status: To Do
---

## Implementation Plan

- Step A
- Step B

## Description

Some description
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.plan).toBe('- Step A\n- Step B');
    });

    it('should handle missing new fields gracefully', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Minimal task
status: To Do
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.references).toBeUndefined();
      expect(task?.documentation).toBeUndefined();
      expect(task?.type).toBeUndefined();
      expect(task?.plan).toBeUndefined();
    });

    it('should handle references as single string', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
references: https://example.com/single
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.references).toEqual(['https://example.com/single']);
    });

    it('should handle documentation as single string', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
documentation: docs/README.md
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.documentation).toEqual(['docs/README.md']);
    });

    it('should not confuse ## Plan with ## Implementation Notes', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Plan

This is the plan content.

## Implementation Notes

These are implementation notes.
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.plan).toBe('This is the plan content.');
      expect(task?.implementationNotes).toBe('These are implementation notes.');
    });
  });

  describe('getUniqueLabels', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return merged labels from config and all tasks, sorted', async () => {
      const configContent = `labels: ["bug", "feature"]`;
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('config') || pathStr.includes('tasks');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1.md', 'task-2.md']);

      const parser = new BacklogParser('/fake/backlog');
      // Mock parseTaskFile to return tasks with labels
      vi.spyOn(parser, 'parseTaskFile').mockImplementation(async (filePath: string) => {
        if (filePath.includes('task-1')) {
          return {
            id: 'TASK-1',
            title: 'Task 1',
            status: 'To Do' as const,
            labels: ['urgent', 'bug'],
            assignee: [],
            dependencies: [],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        return {
          id: 'TASK-2',
          title: 'Task 2',
          status: 'To Do' as const,
          labels: ['enhancement'],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        };
      });

      const labels = await parser.getUniqueLabels();
      expect(labels).toEqual(['bug', 'enhancement', 'feature', 'urgent']);
    });

    it('should return empty array when no config and no tasks', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const parser = new BacklogParser('/fake/backlog');
      const labels = await parser.getUniqueLabels();

      expect(labels).toEqual([]);
    });
  });

  describe('getUniqueAssignees', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return unique assignees from all tasks, sorted', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('tasks');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1.md', 'task-2.md']);

      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'parseTaskFile').mockImplementation(async (filePath: string) => {
        if (filePath.includes('task-1')) {
          return {
            id: 'TASK-1',
            title: 'Task 1',
            status: 'To Do' as const,
            labels: [],
            assignee: ['alice', 'bob'],
            dependencies: [],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        return {
          id: 'TASK-2',
          title: 'Task 2',
          status: 'To Do' as const,
          labels: [],
          assignee: ['charlie', 'alice'],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        };
      });

      const assignees = await parser.getUniqueAssignees();
      expect(assignees).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should return empty array when no tasks have assignees', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('tasks');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1.md']);

      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'parseTaskFile').mockResolvedValue({
        id: 'TASK-1',
        title: 'Task 1',
        status: 'To Do' as const,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/backlog/tasks/task-1.md',
      });

      const assignees = await parser.getUniqueAssignees();
      expect(assignees).toEqual([]);
    });
  });

  describe('getBlockedByThisTask', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return task IDs that depend on the given task', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('tasks');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'task-1.md',
        'task-2.md',
        'task-3.md',
      ]);

      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'parseTaskFile').mockImplementation(async (filePath: string) => {
        if (filePath.includes('task-1')) {
          return {
            id: 'TASK-1',
            title: 'Task 1',
            status: 'To Do' as const,
            labels: [],
            assignee: [],
            dependencies: [], // No dependencies
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        if (filePath.includes('task-2')) {
          return {
            id: 'TASK-2',
            title: 'Task 2',
            status: 'To Do' as const,
            labels: [],
            assignee: [],
            dependencies: ['TASK-1'], // Depends on TASK-1
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        return {
          id: 'TASK-3',
          title: 'Task 3',
          status: 'To Do' as const,
          labels: [],
          assignee: [],
          dependencies: ['TASK-1'], // Also depends on TASK-1
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        };
      });

      const blockedBy = await parser.getBlockedByThisTask('TASK-1');
      expect(blockedBy).toEqual(['TASK-2', 'TASK-3']);
    });

    it('should return empty array if no tasks depend on given task', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('tasks');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1.md', 'task-2.md']);

      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'parseTaskFile').mockImplementation(async (filePath: string) => {
        if (filePath.includes('task-1')) {
          return {
            id: 'TASK-1',
            title: 'Task 1',
            status: 'To Do' as const,
            labels: [],
            assignee: [],
            dependencies: [],
            acceptanceCriteria: [],
            definitionOfDone: [],
            filePath,
          };
        }
        return {
          id: 'TASK-2',
          title: 'Task 2',
          status: 'To Do' as const,
          labels: [],
          assignee: [],
          dependencies: [], // No dependencies
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        };
      });

      const blockedBy = await parser.getBlockedByThisTask('TASK-1');
      expect(blockedBy).toEqual([]);
    });

    it('should return empty array for non-existent task', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('tasks');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1.md']);

      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'parseTaskFile').mockResolvedValue({
        id: 'TASK-1',
        title: 'Task 1',
        status: 'To Do' as const,
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/backlog/tasks/task-1.md',
      });

      const blockedBy = await parser.getBlockedByThisTask('TASK-999');
      expect(blockedBy).toEqual([]);
    });
  });

  describe('Edge Cases: Section Parsing', () => {
    it('should handle description without markers', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

This is a plain description without markers.

## Acceptance Criteria

- [ ] #1 Test
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toBe('This is a plain description without markers.');
    });

    it('should handle nested markdown in description', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Subsection

- List item 1
- List item 2

\`\`\`javascript
const code = "example";
\`\`\`
<!-- SECTION:DESCRIPTION:END -->
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toContain('### Subsection');
      expect(task?.description).toContain('- List item 1');
      expect(task?.description).toContain('const code = "example"');
    });

    it('should handle title extracted from heading when not in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
status: To Do
---

# TASK-1 - My Task Title From Heading

## Description

Some content
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.title).toBe('My Task Title From Heading');
    });
  });
});
