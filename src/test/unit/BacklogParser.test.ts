import { describe, it, expect } from 'vitest';
import { BacklogParser } from '../../core/BacklogParser';

describe('BacklogParser', () => {
  describe('parseTaskContent', () => {
    it('should parse a basic task file', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `# TASK-1 - Test Task Title

Status: ○ To Do
Priority: High
Labels: bug, urgent
Milestone: MVP Release

Description:
--------------------------------------------------
This is the task description.

Acceptance Criteria:
--------------------------------------------------
- [ ] #1 First criterion
- [x] #2 Second criterion completed
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

    it('should parse status with symbols', () => {
      const parser = new BacklogParser('/fake/path');

      const testCases = [
        { input: 'Status: ○ To Do', expected: 'To Do' },
        { input: 'Status: ◒ In Progress', expected: 'In Progress' },
        { input: 'Status: ● Done', expected: 'Done' },
        { input: 'Status: To Do', expected: 'To Do' },
        { input: 'Status: In Progress', expected: 'In Progress' },
      ];

      for (const { input, expected } of testCases) {
        const content = `# TASK-1 - Test\n\n${input}`;
        const task = parser.parseTaskContent(content, '/fake/task-1.md');
        expect(task?.status).toBe(expected);
      }
    });

    it('should parse multiple assignees', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `# TASK-1 - Test

Status: To Do
Assignee: alice, bob, charlie
`;

      const task = parser.parseTaskContent(content, '/fake/task-1.md');
      expect(task?.assignee).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should handle empty or missing sections', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `# TASK-1 - Minimal Task

Status: To Do
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
      const content = `# TASK-1 - Test

Status: To Do

Definition of Done:
--------------------------------------------------
- [ ] #1 Code reviewed
- [ ] #2 Tests passing
- [x] #3 Documentation updated
`;

      const task = parser.parseTaskContent(content, '/fake/task-1.md');

      expect(task?.definitionOfDone).toHaveLength(3);
      expect(task?.definitionOfDone[2].checked).toBe(true);
    });
  });
});
