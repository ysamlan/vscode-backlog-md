import { describe, it, expect } from 'vitest';
import { BacklogParser } from '../../core/BacklogParser';

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

      const task = parser.parseTaskContent(
        content,
        '/fake/path/task-42 - Some-Task-Name.md'
      );
      expect(task?.id).toBe('TASK-42');
    });
  });
});
