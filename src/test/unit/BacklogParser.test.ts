import { describe, it, expect, vi, afterEach } from 'vitest';
import { BacklogParser, computeSubtasks } from '../../core/BacklogParser';
import type { Task } from '../../core/types';
import * as fs from 'fs';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn().mockReturnValue({ mtimeMs: 1000 }),
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
        { status: 'Review', expected: 'Review' },
        { status: 'QA', expected: 'QA' },
        { status: 'Backlog', expected: 'Backlog' },
        { status: 'Blocked', expected: 'Blocked' },
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

    it('should preserve custom status values', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Custom Status Test
status: Code Review
---
`;
      const task = parser.parseTaskContent(content, '/fake/task-1.md');
      expect(task?.status).toBe('Code Review');
    });

    it('should preserve custom status with unicode prefix stripped', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: "◑ Waiting"
---
`;
      const task = parser.parseTaskContent(content, '/fake/task-1.md');
      expect(task?.status).toBe('Waiting');
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

    it('should extract custom-prefix ID from filename', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: Custom Prefix Task
status: To Do
---
`;

      const task = parser.parseTaskContent(content, '/fake/path/proj-7 - Custom-Prefix-Task.md');
      expect(task?.id).toBe('PROJ-7');
    });

    it('should extract subtask ID with dot notation from filename', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: Subtask
status: To Do
---
`;

      const task = parser.parseTaskContent(content, '/fake/path/issue-3.2 - Subtask.md');
      expect(task?.id).toBe('ISSUE-3.2');
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

    it('should cache config and return cached value on second call', async () => {
      const configContent = `project_name: "Cached Project"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');
      const config1 = await parser.getConfig();
      const config2 = await parser.getConfig();

      expect(config1.project_name).toBe('Cached Project');
      expect(config2.project_name).toBe('Cached Project');
      // readFileSync should only be called once (cached on second call)
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should re-read config when mtime changes', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`project_name: "V1"`);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');
      const config1 = await parser.getConfig();
      expect(config1.project_name).toBe('V1');

      // Simulate file modification
      vi.mocked(fs.readFileSync).mockReturnValue(`project_name: "V2"`);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 2000 } as fs.Stats);

      const config2 = await parser.getConfig();
      expect(config2.project_name).toBe('V2');
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should re-read config after invalidateConfigCache()', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`project_name: "Original"`);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');
      await parser.getConfig();

      parser.invalidateConfigCache();

      vi.mocked(fs.readFileSync).mockReturnValue(`project_name: "Updated"`);
      const config = await parser.getConfig();
      expect(config.project_name).toBe('Updated');
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMilestones', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should load milestones from milestone files as source of truth', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('/milestones') || pathStr.endsWith('config.yml');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.endsWith('/milestones')) {
          return ['m-2 - Beta.md', 'README.md', 'm-1 - Launch.md'] as unknown as string[];
        }
        return [] as unknown as string[];
      });
      vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('/milestones/m-1')) {
          return `---
id: m-1
title: Launch
---

## Description

Launch milestone`;
        }
        if (pathStr.includes('/milestones/m-2')) {
          return `---
id: m-2
title: Beta
---`;
        }
        if (pathStr.endsWith('config.yml')) {
          return `milestones: ["legacy-v1"]`;
        }
        return '';
      });

      const parser = new BacklogParser('/fake/backlog');
      const milestones = await parser.getMilestones();

      expect(milestones).toEqual([
        { id: 'm-1', name: 'Launch', description: 'Launch milestone' },
        { id: 'm-2', name: 'Beta' },
      ]);
    });

    it('should fallback to config string-array milestones when milestone files are absent', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.endsWith('config.yml');
      });
      vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.endsWith('config.yml')) {
          return `milestones: ["v1.0", "v2.0"]`;
        }
        return '';
      });

      const parser = new BacklogParser('/fake/backlog');
      const milestones = await parser.getMilestones();

      expect(milestones).toEqual([
        { id: 'v1.0', name: 'v1.0' },
        { id: 'v2.0', name: 'v2.0' },
      ]);
    });

    it('should canonicalize task milestone titles to known milestone IDs when unambiguous', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('/tasks') || pathStr.includes('/milestones');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.endsWith('/tasks')) {
          return ['task-1 - Example.md'] as unknown as string[];
        }
        if (pathStr.endsWith('/milestones')) {
          return ['m-1 - Launch.md'] as unknown as string[];
        }
        return [] as unknown as string[];
      });
      vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('/milestones/m-1')) {
          return `---
id: m-1
title: Launch
---`;
        }
        if (pathStr.includes('/tasks/task-1')) {
          return `---
id: TASK-1
title: Example
status: To Do
milestone: Launch
---
`;
        }
        return '';
      });

      const parser = new BacklogParser('/fake/backlog');
      const tasks = await parser.getTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.milestone).toBe('m-1');
    });

    it('should keep raw milestone value when title matches multiple milestone IDs', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('/tasks') || pathStr.includes('/milestones');
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.endsWith('/tasks')) {
          return ['task-1 - Example.md'] as unknown as string[];
        }
        if (pathStr.endsWith('/milestones')) {
          return ['m-1 - Launch-A.md', 'm-2 - Launch-B.md'] as unknown as string[];
        }
        return [] as unknown as string[];
      });
      vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('/milestones/m-1')) {
          return `---
id: m-1
title: Launch
---`;
        }
        if (pathStr.includes('/milestones/m-2')) {
          return `---
id: m-2
title: Launch
---`;
        }
        if (pathStr.includes('/tasks/task-1')) {
          return `---
id: TASK-1
title: Example
status: To Do
milestone: Launch
---
`;
        }
        return '';
      });

      const parser = new BacklogParser('/fake/backlog');
      const tasks = await parser.getTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.milestone).toBe('Launch');
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

    it('should normalize zero_padded_ids: true to 3', async () => {
      const configContent = `
zero_padded_ids: true
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.zero_padded_ids).toBe(3);
    });

    it('should parse zero_padded_ids as a number', async () => {
      const configContent = `
zero_padded_ids: 4
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.zero_padded_ids).toBe(4);
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
      expect(config.zero_padded_ids).toBeUndefined();
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

  describe('Config: Additional Fields', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should parse auto_commit option from config', async () => {
      const configContent = `auto_commit: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.auto_commit).toBe(true);
    });

    it('should parse bypass_git_hooks option from config', async () => {
      const configContent = `bypass_git_hooks: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.bypass_git_hooks).toBe(true);
    });

    it('should parse auto_open_browser option from config', async () => {
      const configContent = `auto_open_browser: false`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.auto_open_browser).toBe(false);
    });

    it('should parse default_port option from config', async () => {
      const configContent = `default_port: 8080`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_port).toBe(8080);
    });

    it('should parse max_column_width option from config', async () => {
      const configContent = `max_column_width: 5`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.max_column_width).toBe(5);
    });

    it('should parse task_prefix option from config', async () => {
      const configContent = `task_prefix: "PROJ"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.task_prefix).toBe('PROJ');
    });

    it('should parse date_format option from config', async () => {
      const configContent = `date_format: "yyyy-mm-dd"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.date_format).toBe('yyyy-mm-dd');
    });

    it('should parse default_status option from config', async () => {
      const configContent = `default_status: "Backlog"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_status).toBe('Backlog');
    });

    it('should parse priorities array from config', async () => {
      const configContent = `priorities: ["critical", "high", "medium", "low"]`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.priorities).toEqual(['critical', 'high', 'medium', 'low']);
    });

    it('should parse default_assignee option from config', async () => {
      const configContent = `default_assignee: "@alice"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_assignee).toBe('@alice');
    });

    it('should parse default_reporter option from config', async () => {
      const configContent = `default_reporter: "@bob"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_reporter).toBe('@bob');
    });

    it('should parse default_editor option from config', async () => {
      const configContent = `default_editor: "vim"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_editor).toBe('vim');
    });

    it('should parse definition_of_done array from config', async () => {
      const configContent = `
definition_of_done:
  - "Code reviewed"
  - "Tests passing"
  - "Documentation updated"
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.definition_of_done).toEqual([
        'Code reviewed',
        'Tests passing',
        'Documentation updated',
      ]);
    });

    it('should parse timezone_preference option from config', async () => {
      const configContent = `timezone_preference: "America/New_York"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.timezone_preference).toBe('America/New_York');
    });

    it('should parse include_date_time_in_dates option from config', async () => {
      const configContent = `include_date_time_in_dates: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.include_date_time_in_dates).toBe(true);
    });

    it('should parse on_status_change option from config', async () => {
      const configContent = `on_status_change: "auto_commit"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.on_status_change).toBe('auto_commit');
    });

    it('should parse milestones array from config', async () => {
      const configContent = `
milestones:
  - name: "v1.0"
    description: "Initial release"
  - name: "v2.0"
    description: "Major update"
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.milestones).toEqual([
        { name: 'v1.0', description: 'Initial release' },
        { name: 'v2.0', description: 'Major update' },
      ]);
    });

    it('should parse milestones as simple string array from config', async () => {
      const configContent = `milestones: ["v1.0", "v2.0", "v3.0"]`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.milestones).toEqual(['v1.0', 'v2.0', 'v3.0']);
    });

    it('should parse config with all fields populated', async () => {
      const configContent = `
project_name: "Full Config Project"
default_status: "Backlog"
default_assignee: "@lead"
default_reporter: "@pm"
default_editor: "code"
statuses: ["Backlog", "To Do", "In Progress", "Review", "Done"]
priorities: ["critical", "high", "medium", "low"]
labels: ["bug", "feature", "docs"]
milestones:
  - name: "v1.0"
    description: "Initial release"
definition_of_done:
  - "Code reviewed"
  - "Tests passing"
date_format: "yyyy-mm-dd"
max_column_width: 5
auto_open_browser: true
default_port: 3000
remote_operations: true
auto_commit: false
bypass_git_hooks: false
check_active_branches: true
active_branch_days: 14
task_prefix: "PROJ"
task_resolution_strategy: most_recent
zero_padded_ids: true
timezone_preference: "UTC"
include_date_time_in_dates: false
on_status_change: "auto_commit"
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.project_name).toBe('Full Config Project');
      expect(config.default_status).toBe('Backlog');
      expect(config.default_assignee).toBe('@lead');
      expect(config.default_reporter).toBe('@pm');
      expect(config.default_editor).toBe('code');
      expect(config.statuses).toEqual(['Backlog', 'To Do', 'In Progress', 'Review', 'Done']);
      expect(config.priorities).toEqual(['critical', 'high', 'medium', 'low']);
      expect(config.labels).toEqual(['bug', 'feature', 'docs']);
      expect(config.milestones).toHaveLength(1);
      expect(config.definition_of_done).toEqual(['Code reviewed', 'Tests passing']);
      expect(config.date_format).toBe('yyyy-mm-dd');
      expect(config.max_column_width).toBe(5);
      expect(config.auto_open_browser).toBe(true);
      expect(config.default_port).toBe(3000);
      expect(config.remote_operations).toBe(true);
      expect(config.auto_commit).toBe(false);
      expect(config.bypass_git_hooks).toBe(false);
      expect(config.check_active_branches).toBe(true);
      expect(config.active_branch_days).toBe(14);
      expect(config.task_prefix).toBe('PROJ');
      expect(config.task_resolution_strategy).toBe('most_recent');
      expect(config.zero_padded_ids).toBe(3); // true normalized to 3
      expect(config.timezone_preference).toBe('UTC');
      expect(config.include_date_time_in_dates).toBe(false);
      expect(config.on_status_change).toBe('auto_commit');
    });

    it('should handle empty YAML file (null content)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('');

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config).toEqual({});
    });

    it('should handle YAML file with only comments', async () => {
      const configContent = `
# This is a comment
# Another comment
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config).toEqual({});
    });
  });

  describe('Config: camelCase to snake_case normalization', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should normalize autoCommit to auto_commit', async () => {
      const configContent = `autoCommit: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.auto_commit).toBe(true);
    });

    it('should normalize bypassGitHooks to bypass_git_hooks', async () => {
      const configContent = `bypassGitHooks: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.bypass_git_hooks).toBe(true);
    });

    it('should normalize checkActiveBranches to check_active_branches', async () => {
      const configContent = `checkActiveBranches: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.check_active_branches).toBe(true);
    });

    it('should normalize activeBranchDays to active_branch_days', async () => {
      const configContent = `activeBranchDays: 30`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.active_branch_days).toBe(30);
    });

    it('should normalize remoteOperations to remote_operations', async () => {
      const configContent = `remoteOperations: false`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.remote_operations).toBe(false);
    });

    it('should normalize taskResolutionStrategy to task_resolution_strategy', async () => {
      const configContent = `taskResolutionStrategy: most_progressed`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.task_resolution_strategy).toBe('most_progressed');
    });

    it('should normalize zeroPaddedIds to zero_padded_ids', async () => {
      const configContent = `zeroPaddedIds: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.zero_padded_ids).toBe(3); // true normalized to 3
    });

    it('should normalize autoOpenBrowser to auto_open_browser', async () => {
      const configContent = `autoOpenBrowser: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.auto_open_browser).toBe(true);
    });

    it('should normalize defaultPort to default_port', async () => {
      const configContent = `defaultPort: 9090`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_port).toBe(9090);
    });

    it('should normalize maxColumnWidth to max_column_width', async () => {
      const configContent = `maxColumnWidth: 8`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.max_column_width).toBe(8);
    });

    it('should normalize projectName to project_name', async () => {
      const configContent = `projectName: "Camel Case Project"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.project_name).toBe('Camel Case Project');
    });

    it('should normalize defaultStatus to default_status', async () => {
      const configContent = `defaultStatus: "In Progress"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_status).toBe('In Progress');
    });

    it('should normalize defaultAssignee to default_assignee', async () => {
      const configContent = `defaultAssignee: "@charlie"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_assignee).toBe('@charlie');
    });

    it('should normalize defaultReporter to default_reporter', async () => {
      const configContent = `defaultReporter: "@dave"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_reporter).toBe('@dave');
    });

    it('should normalize defaultEditor to default_editor', async () => {
      const configContent = `defaultEditor: "nano"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.default_editor).toBe('nano');
    });

    it('should normalize definitionOfDone to definition_of_done', async () => {
      const configContent = `definitionOfDone: ["Code reviewed", "Tests pass"]`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.definition_of_done).toEqual(['Code reviewed', 'Tests pass']);
    });

    it('should normalize timezonePreference to timezone_preference', async () => {
      const configContent = `timezonePreference: "Europe/London"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.timezone_preference).toBe('Europe/London');
    });

    it('should normalize includeDateTimeInDates to include_date_time_in_dates', async () => {
      const configContent = `includeDateTimeInDates: true`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.include_date_time_in_dates).toBe(true);
    });

    it('should normalize onStatusChange to on_status_change', async () => {
      const configContent = `onStatusChange: "auto_commit"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.on_status_change).toBe('auto_commit');
    });

    it('should handle mixed camelCase and snake_case in same config', async () => {
      const configContent = `
projectName: "Mixed Config"
default_status: "To Do"
autoCommit: true
bypass_git_hooks: false
checkActiveBranches: true
active_branch_days: 7
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.project_name).toBe('Mixed Config');
      expect(config.default_status).toBe('To Do');
      expect(config.auto_commit).toBe(true);
      expect(config.bypass_git_hooks).toBe(false);
      expect(config.check_active_branches).toBe(true);
      expect(config.active_branch_days).toBe(7);
    });

    it('should prefer snake_case when both variants present', async () => {
      const configContent = `
auto_commit: true
autoCommit: false
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      // snake_case should come first in YAML iteration and win
      expect(config.auto_commit).toBe(true);
    });

    it('should handle snake_case fields that are already in correct format', async () => {
      const configContent = `
project_name: "Snake Case Only"
check_active_branches: true
remote_operations: false
task_resolution_strategy: most_recent
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const parser = new BacklogParser('/fake/backlog');
      const config = await parser.getConfig();

      expect(config.project_name).toBe('Snake Case Only');
      expect(config.check_active_branches).toBe(true);
      expect(config.remote_operations).toBe(false);
      expect(config.task_resolution_strategy).toBe('most_recent');
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

    it('should handle unquoted @-prefixed reporter value', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: BACK-91
title: 'Fix Windows issues: empty task list'
status: Done
reporter: @MrLesk
assignee: @MrLesk
created_date: '2025-06-19'
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/back-91.md');
      expect(task).toBeDefined();
      expect(task?.title).toBe('Fix Windows issues: empty task list');
      expect(task?.reporter).toBe('@MrLesk');
      expect(task?.assignee).toEqual(['@MrLesk']);
    });

    it('should handle unquoted @-prefixed values in inline arrays', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Team task
status: To Do
assignee: [@alice, @bob]
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task).toBeDefined();
      expect(task?.assignee).toEqual(['@alice', '@bob']);
    });

    it('should not double-quote already-quoted @-prefixed values', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Already quoted
status: To Do
reporter: '@quoted'
assignee: ["@alice", '@bob']
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task).toBeDefined();
      expect(task?.reporter).toBe('@quoted');
      expect(task?.assignee).toEqual(['@alice', '@bob']);
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
      expect(task?.implementationPlan).toBe('1. First step\n2. Second step\n3. Third step');
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
      expect(task?.implementationPlan).toBe('- Step A\n- Step B');
    });

    it('should preserve markdown headings inside structured section markers', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test headings in plan
status: To Do
---

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. First step
2. Second step

## Some heading inside plan

More content here
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Note text

## Subheading in notes

More notes
<!-- SECTION:NOTES:END -->
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.implementationPlan).toBe(
        '1. First step\n2. Second step\n\n## Some heading inside plan\n\nMore content here'
      );
      expect(task?.implementationNotes).toBe('Note text\n\n## Subheading in notes\n\nMore notes');
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
      expect(task?.implementationPlan).toBeUndefined();
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
      expect(task?.implementationPlan).toBe('This is the plan content.');
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

  describe('Multi-folder support', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('getTasksFromFolder', () => {
      it('should read tasks from specified subfolder', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1 - My-Task.md']);
        vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-1
title: My Task
status: To Do
---
`);

        const parser = new BacklogParser('/fake/backlog');
        const tasks = await parser.getTasksFromFolder('tasks');

        expect(tasks).toHaveLength(1);
        expect(tasks[0].folder).toBe('tasks');
        expect(tasks[0].id).toBe('TASK-1');
      });

      it('should return empty array when folder does not exist', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const parser = new BacklogParser('/fake/backlog');
        const tasks = await parser.getTasksFromFolder('drafts');

        expect(tasks).toEqual([]);
      });

      it('should set the correct folder property on each task', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['draft-1 - My-Draft.md']);
        vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: Draft
---
`);

        const parser = new BacklogParser('/fake/backlog');
        const tasks = await parser.getTasksFromFolder('drafts');

        expect(tasks).toHaveLength(1);
        expect(tasks[0].folder).toBe('drafts');
      });

      it('should deduplicate tasks with the same ID, keeping the last file', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
          'back-239 - Feature-Auto-link-old.md',
          'back-239 - Feature-Auto-link-new.md',
        ]);
        vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
          if (String(filePath).includes('old')) {
            return `---\nid: BACK-239\ntitle: Old version\nstatus: To Do\n---\n`;
          }
          return `---\nid: BACK-239\ntitle: New version\nstatus: In Progress\n---\n`;
        });

        const parser = new BacklogParser('/fake/backlog');
        const tasks = await parser.getTasksFromFolder('tasks');

        expect(tasks).toHaveLength(1);
        expect(tasks[0].id).toBe('BACK-239');
        expect(tasks[0].title).toBe('New version');
      });

      it('should not deduplicate tasks with distinct IDs', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
          'task-1 - First.md',
          'task-2 - Second.md',
        ]);
        vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
          if (String(filePath).includes('task-1')) {
            return `---\nid: TASK-1\ntitle: First\nstatus: To Do\n---\n`;
          }
          return `---\nid: TASK-2\ntitle: Second\nstatus: To Do\n---\n`;
        });

        const parser = new BacklogParser('/fake/backlog');
        const tasks = await parser.getTasksFromFolder('tasks');

        expect(tasks).toHaveLength(2);
      });
    });

    describe('getDrafts', () => {
      it('should return tasks with folder set to drafts', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['draft-1 - My-Draft.md']);
        vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: My Draft
status: To Do
---
`);

        const parser = new BacklogParser('/fake/backlog');
        const drafts = await parser.getDrafts();

        expect(drafts).toHaveLength(1);
        expect(drafts[0].folder).toBe('drafts');
        expect(drafts[0].status).toBe('Draft');
      });

      it('should enforce Draft status on all drafts', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['draft-1 - Active-Draft.md']);
        vi.mocked(fs.readFileSync).mockReturnValue(`---
id: DRAFT-1
title: Active Draft
status: In Progress
---
`);

        const parser = new BacklogParser('/fake/backlog');
        const drafts = await parser.getDrafts();

        expect(drafts).toHaveLength(1);
        expect(drafts[0].status).toBe('Draft');
      });

      it('should return empty array when no drafts folder exists', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const parser = new BacklogParser('/fake/backlog');
        const drafts = await parser.getDrafts();

        expect(drafts).toEqual([]);
      });
    });

    describe('getCompletedTasks', () => {
      it('should return tasks with folder set to completed', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1 - Done-Task.md']);
        vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-1
title: Done Task
status: Done
---
`);

        const parser = new BacklogParser('/fake/backlog');
        const completed = await parser.getCompletedTasks();

        expect(completed).toHaveLength(1);
        expect(completed[0].folder).toBe('completed');
        expect(completed[0].source).toBe('completed');
      });

      it('should return empty array when no completed folder exists', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const parser = new BacklogParser('/fake/backlog');
        const completed = await parser.getCompletedTasks();

        expect(completed).toEqual([]);
      });
    });

    describe('getTask across folders', () => {
      it('should find task in tasks folder first', async () => {
        const parser = new BacklogParser('/fake/backlog');

        // Mock getTasksFromFolder to return tasks from different folders
        vi.spyOn(parser, 'getTasksFromFolder').mockImplementation(async (folder: string) => {
          if (folder === 'tasks') {
            return [
              {
                id: 'TASK-1',
                title: 'In Tasks',
                status: 'To Do' as const,
                folder: 'tasks' as const,
                filePath: '/fake/backlog/tasks/task-1.md',
                labels: [],
                assignee: [],
                dependencies: [],
                acceptanceCriteria: [],
                definitionOfDone: [],
              },
            ];
          }
          return [];
        });

        const task = await parser.getTask('TASK-1');
        expect(task?.folder).toBe('tasks');
        expect(task?.title).toBe('In Tasks');
      });

      it('should find task in drafts folder when not in tasks', async () => {
        const parser = new BacklogParser('/fake/backlog');

        vi.spyOn(parser, 'getTasksFromFolder').mockImplementation(async (folder: string) => {
          if (folder === 'tasks') return [];
          if (folder === 'drafts') {
            return [
              {
                id: 'DRAFT-1',
                title: 'In Drafts',
                status: 'Draft' as const,
                folder: 'drafts' as const,
                filePath: '/fake/backlog/drafts/draft-1.md',
                labels: [],
                assignee: [],
                dependencies: [],
                acceptanceCriteria: [],
                definitionOfDone: [],
              },
            ];
          }
          return [];
        });

        const task = await parser.getTask('DRAFT-1');
        expect(task?.folder).toBe('drafts');
      });

      it('should find task in completed folder as last resort', async () => {
        const parser = new BacklogParser('/fake/backlog');

        vi.spyOn(parser, 'getTasksFromFolder').mockImplementation(async (folder: string) => {
          if (folder === 'completed') {
            return [
              {
                id: 'TASK-5',
                title: 'Completed',
                status: 'Done' as const,
                folder: 'completed' as const,
                filePath: '/fake/backlog/completed/task-5.md',
                labels: [],
                assignee: [],
                dependencies: [],
                acceptanceCriteria: [],
                definitionOfDone: [],
              },
            ];
          }
          return [];
        });

        const task = await parser.getTask('TASK-5');
        expect(task?.folder).toBe('completed');
      });

      it('should return undefined when task not found in any folder', async () => {
        const parser = new BacklogParser('/fake/backlog');
        vi.spyOn(parser, 'getTasksFromFolder').mockResolvedValue([]);

        const task = await parser.getTask('TASK-999');
        expect(task).toBeUndefined();
      });
    });

    describe('Draft filename parsing', () => {
      it('should parse draft- prefix in filename for ID extraction', () => {
        const parser = new BacklogParser('/fake/path');
        const content = `---
title: My Draft Task
status: Draft
---
`;
        const task = parser.parseTaskContent(content, '/fake/path/draft-1 - My-Draft.md');
        expect(task?.id).toBe('DRAFT-1');
      });

      it('should still parse task- prefix as before', () => {
        const parser = new BacklogParser('/fake/path');
        const content = `---
title: Regular Task
status: To Do
---
`;
        const task = parser.parseTaskContent(content, '/fake/path/task-42 - Regular.md');
        expect(task?.id).toBe('TASK-42');
      });
    });
  });

  describe('Parent-child task parsing', () => {
    it('should parse parent_task_id from frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-2.1
title: Subtask
status: To Do
parent_task_id: TASK-2
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-2.1.md');
      expect(task?.parentTaskId).toBe('TASK-2');
    });

    it('should parse parent field as alias for parent_task_id', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-3.1
title: Subtask with parent alias
status: To Do
parent: TASK-3
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-3.1.md');
      expect(task?.parentTaskId).toBe('TASK-3');
    });

    it('should parse subtasks array from frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-2
title: Parent Task
status: In Progress
subtasks: [TASK-2.1, TASK-2.2]
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-2.md');
      expect(task?.subtasks).toEqual(['TASK-2.1', 'TASK-2.2']);
    });

    it('should parse subtasks as multi-line array', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-2
title: Parent Task
status: In Progress
subtasks:
  - TASK-2.1
  - TASK-2.2
  - TASK-2.3
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-2.md');
      expect(task?.subtasks).toEqual(['TASK-2.1', 'TASK-2.2', 'TASK-2.3']);
    });

    it('should handle subtasks as single string', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-2
title: Parent Task
status: In Progress
subtasks: TASK-2.1
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-2.md');
      expect(task?.subtasks).toEqual(['TASK-2.1']);
    });

    it('should not have subtasks when field is absent', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Regular Task
status: To Do
---
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.subtasks).toBeUndefined();
    });
  });

  describe('computeSubtasks', () => {
    function makeTask(overrides: Partial<Task>): Task {
      return {
        id: 'TASK-1',
        title: 'Test',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/fake/path/task.md',
        ...overrides,
      };
    }

    it('should populate subtasks on parent from child parentTaskId', () => {
      const tasks = [
        makeTask({ id: 'TASK-2', title: 'Parent' }),
        makeTask({ id: 'TASK-2.1', title: 'Child 1', parentTaskId: 'TASK-2' }),
        makeTask({ id: 'TASK-2.2', title: 'Child 2', parentTaskId: 'TASK-2' }),
      ];

      computeSubtasks(tasks);

      expect(tasks[0].subtasks).toEqual(['TASK-2.1', 'TASK-2.2']);
    });

    it('should sort subtask IDs', () => {
      const tasks = [
        makeTask({ id: 'TASK-1' }),
        makeTask({ id: 'TASK-1.3', parentTaskId: 'TASK-1' }),
        makeTask({ id: 'TASK-1.1', parentTaskId: 'TASK-1' }),
        makeTask({ id: 'TASK-1.2', parentTaskId: 'TASK-1' }),
      ];

      computeSubtasks(tasks);

      expect(tasks[0].subtasks).toEqual(['TASK-1.1', 'TASK-1.2', 'TASK-1.3']);
    });

    it('should not add subtasks to tasks with no children', () => {
      const tasks = [makeTask({ id: 'TASK-1' }), makeTask({ id: 'TASK-2' })];

      computeSubtasks(tasks);

      expect(tasks[0].subtasks).toBeUndefined();
      expect(tasks[1].subtasks).toBeUndefined();
    });

    it('should handle orphaned children (parent not in list)', () => {
      const tasks = [
        makeTask({ id: 'TASK-5.1', parentTaskId: 'TASK-5' }),
        makeTask({ id: 'TASK-5.2', parentTaskId: 'TASK-5' }),
      ];

      computeSubtasks(tasks);

      // No parent in the list, so no subtasks array is set
      expect(tasks[0].subtasks).toBeUndefined();
      expect(tasks[1].subtasks).toBeUndefined();
    });

    it('should overwrite existing subtasks from frontmatter', () => {
      const tasks = [
        makeTask({ id: 'TASK-3', subtasks: ['TASK-3.1', 'TASK-3.99'] }),
        makeTask({ id: 'TASK-3.1', parentTaskId: 'TASK-3' }),
        makeTask({ id: 'TASK-3.2', parentTaskId: 'TASK-3' }),
      ];

      computeSubtasks(tasks);

      // Should be computed from parentTaskId, not from the existing array
      expect(tasks[0].subtasks).toEqual(['TASK-3.1', 'TASK-3.2']);
    });

    it('should handle multiple parents with different children', () => {
      const tasks = [
        makeTask({ id: 'TASK-1' }),
        makeTask({ id: 'TASK-2' }),
        makeTask({ id: 'TASK-1.1', parentTaskId: 'TASK-1' }),
        makeTask({ id: 'TASK-2.1', parentTaskId: 'TASK-2' }),
        makeTask({ id: 'TASK-2.2', parentTaskId: 'TASK-2' }),
      ];

      computeSubtasks(tasks);

      expect(tasks[0].subtasks).toEqual(['TASK-1.1']);
      expect(tasks[1].subtasks).toEqual(['TASK-2.1', 'TASK-2.2']);
    });

    it('should handle empty task list', () => {
      const tasks: Task[] = [];
      computeSubtasks(tasks);
      expect(tasks).toEqual([]);
    });

    it('should populate subtaskSummaries with title and status', () => {
      const tasks = [
        makeTask({ id: 'TASK-1', title: 'Parent', status: 'In Progress' }),
        makeTask({ id: 'TASK-1.1', title: 'Child One', status: 'Done', parentTaskId: 'TASK-1' }),
        makeTask({ id: 'TASK-1.2', title: 'Child Two', status: 'To Do', parentTaskId: 'TASK-1' }),
      ];

      computeSubtasks(tasks);

      expect(tasks[0].subtaskSummaries).toEqual([
        { id: 'TASK-1.1', title: 'Child One', status: 'Done' },
        { id: 'TASK-1.2', title: 'Child Two', status: 'To Do' },
      ]);
    });

    it('should not set subtaskSummaries for tasks without children', () => {
      const tasks = [makeTask({ id: 'TASK-1' })];
      computeSubtasks(tasks);
      expect(tasks[0].subtaskSummaries).toBeUndefined();
    });
  });

  describe('getArchivedTasks', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return tasks from archive/tasks/ folder with folder set to archive', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1 - Archived-Task.md']);
      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-1
title: Archived Task
status: Done
---
`);

      const parser = new BacklogParser('/fake/backlog');
      const archived = await parser.getArchivedTasks();

      expect(archived).toHaveLength(1);
      expect(archived[0].folder).toBe('archive');
      expect(archived[0].id).toBe('TASK-1');
      expect(archived[0].title).toBe('Archived Task');
    });

    it('should return empty array when no archive/tasks/ folder exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const parser = new BacklogParser('/fake/backlog');
      const archived = await parser.getArchivedTasks();

      expect(archived).toEqual([]);
    });

    it('should parse multiple archived tasks', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'task-1 - First.md',
        'task-2 - Second.md',
      ]);

      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'parseTaskFile').mockImplementation(async (filePath: string) => {
        if (filePath.includes('task-1')) {
          return {
            id: 'TASK-1',
            title: 'First Archived',
            status: 'Done' as const,
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
          title: 'Second Archived',
          status: 'To Do' as const,
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath,
        };
      });

      const archived = await parser.getArchivedTasks();

      expect(archived).toHaveLength(2);
      expect(archived[0].folder).toBe('archive');
      expect(archived[1].folder).toBe('archive');
    });
  });

  describe('getTask searches archive folder', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should find task in archive/tasks/ folder when not in other folders', async () => {
      const parser = new BacklogParser('/fake/backlog');

      vi.spyOn(parser, 'getTasksFromFolder').mockImplementation(async (folder: string) => {
        if (folder === 'archive/tasks') {
          return [
            {
              id: 'TASK-10',
              title: 'Archived Task',
              status: 'Done' as const,
              folder: 'archive' as const,
              filePath: '/fake/backlog/archive/tasks/task-10.md',
              labels: [],
              assignee: [],
              dependencies: [],
              acceptanceCriteria: [],
              definitionOfDone: [],
            },
          ];
        }
        return [];
      });

      const task = await parser.getTask('TASK-10');
      expect(task).toBeDefined();
      expect(task?.id).toBe('TASK-10');
      expect(task?.folder).toBe('archive');
    });

    it('should prefer tasks/ over archive/tasks/ when task exists in both', async () => {
      const parser = new BacklogParser('/fake/backlog');

      vi.spyOn(parser, 'getTasksFromFolder').mockImplementation(async (folder: string) => {
        if (folder === 'tasks') {
          return [
            {
              id: 'TASK-1',
              title: 'Active Task',
              status: 'To Do' as const,
              folder: 'tasks' as const,
              filePath: '/fake/backlog/tasks/task-1.md',
              labels: [],
              assignee: [],
              dependencies: [],
              acceptanceCriteria: [],
              definitionOfDone: [],
            },
          ];
        }
        if (folder === 'archive/tasks') {
          return [
            {
              id: 'TASK-1',
              title: 'Archived Task',
              status: 'Done' as const,
              folder: 'archive' as const,
              filePath: '/fake/backlog/archive/tasks/task-1.md',
              labels: [],
              assignee: [],
              dependencies: [],
              acceptanceCriteria: [],
              definitionOfDone: [],
            },
          ];
        }
        return [];
      });

      const task = await parser.getTask('TASK-1');
      expect(task?.folder).toBe('tasks');
      expect(task?.title).toBe('Active Task');
    });

    it('should set folder to archive (not archive/tasks) when found via getTask', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const s = String(p);
        return s.includes('archive/tasks') || s === '/fake/backlog';
      });
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
        if (String(p).includes('archive/tasks')) {
          return ['task-10 - Archived.md'];
        }
        return [];
      });
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1 } as ReturnType<typeof fs.statSync>);
      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-10
title: Archived
status: Done
---
`);

      const parser = new BacklogParser('/fake/backlog');
      const task = await parser.getTask('TASK-10');

      expect(task).toBeDefined();
      expect(task?.folder).toBe('archive');
    });
  });

  describe('parseDocumentContent', () => {
    it('should parse a document with YAML frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: DOC-1
title: API Reference
type: guide
tags: [api, reference]
created_date: 2024-01-15
updated_date: 2024-02-01
---

# API Reference

Some documentation content here.
`;
      const doc = parser.parseDocumentContent(content, '/fake/path/docs/doc-1 - API-Reference.md');
      expect(doc).toBeDefined();
      expect(doc?.id).toBe('DOC-1');
      expect(doc?.title).toBe('API Reference');
      expect(doc?.type).toBe('guide');
      expect(doc?.tags).toEqual(['api', 'reference']);
      expect(doc?.createdAt).toBe('2024-01-15');
      expect(doc?.updatedAt).toBe('2024-02-01');
      expect(doc?.content).toContain('# API Reference');
      expect(doc?.content).toContain('Some documentation content here.');
    });

    it('should extract ID from filename if not in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: Setup Guide
---

# Setup Guide
`;
      const doc = parser.parseDocumentContent(content, '/fake/docs/doc-5 - Setup-Guide.md');
      expect(doc?.id).toBe('DOC-5');
    });

    it('should extract title from first heading if not in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `# My Document Title

Some content here.
`;
      const doc = parser.parseDocumentContent(content, '/fake/docs/doc-1 - Title.md');
      expect(doc?.title).toBe('My Document Title');
    });

    it('should fall back to filename-based title', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `Some content without any heading or frontmatter title.
`;
      const doc = parser.parseDocumentContent(content, '/fake/docs/doc-1 - My-Doc-Title.md');
      expect(doc?.title).toBe('My Doc Title');
    });

    it('should handle empty tags', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: No Tags Doc
tags: []
---
`;
      const doc = parser.parseDocumentContent(content, '/fake/docs/doc-1.md');
      expect(doc?.tags).toEqual([]);
    });

    it('should handle document with no frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `# Quick Start

Get started in 5 minutes.
`;
      const doc = parser.parseDocumentContent(content, '/fake/docs/doc-2 - Quick-Start.md');
      expect(doc?.title).toBe('Quick Start');
      expect(doc?.content).toContain('# Quick Start');
    });

    it('should handle empty content gracefully', () => {
      const parser = new BacklogParser('/fake/path');
      const doc = parser.parseDocumentContent('', '/fake/docs/doc-1 - Title.md');
      // Falls back to filename-based title which is truthy
      expect(doc).toBeDefined();
      expect(doc?.title).toBe('Title');
      expect(doc?.content).toBe('');
    });
  });

  describe('parseDecisionContent', () => {
    it('should parse a decision with YAML frontmatter and sections', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: DECISION-1
title: Use React for Frontend
date: 2024-01-15
status: accepted
---

## Context

We need a frontend framework.

## Decision

We will use React.

## Consequences

Team needs React training.

## Alternatives

Vue.js was also considered.
`;
      const decision = parser.parseDecisionContent(
        content,
        '/fake/decisions/decision-1 - Use-React.md'
      );
      expect(decision).toBeDefined();
      expect(decision?.id).toBe('DECISION-1');
      expect(decision?.title).toBe('Use React for Frontend');
      expect(decision?.date).toBe('2024-01-15');
      expect(decision?.status).toBe('accepted');
      expect(decision?.context).toBe('We need a frontend framework.');
      expect(decision?.decision).toBe('We will use React.');
      expect(decision?.consequences).toBe('Team needs React training.');
      expect(decision?.alternatives).toBe('Vue.js was also considered.');
    });

    it('should extract ID from filename if not in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: Use PostgreSQL
status: proposed
---
`;
      const decision = parser.parseDecisionContent(
        content,
        '/fake/decisions/decision-3 - Use-PostgreSQL.md'
      );
      expect(decision?.id).toBe('DECISION-3');
    });

    it('should parse all decision statuses', () => {
      const parser = new BacklogParser('/fake/path');
      const statuses = ['proposed', 'accepted', 'rejected', 'superseded'];

      for (const status of statuses) {
        const content = `---
title: Test Decision
status: ${status}
---
`;
        const decision = parser.parseDecisionContent(content, '/fake/decisions/decision-1.md');
        expect(decision?.status).toBe(status);
      }
    });

    it('should handle decision with no sections', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
title: Minimal Decision
status: proposed
---
`;
      const decision = parser.parseDecisionContent(content, '/fake/decisions/decision-1.md');
      expect(decision?.title).toBe('Minimal Decision');
      expect(decision?.context).toBeUndefined();
      expect(decision?.decision).toBeUndefined();
      expect(decision?.consequences).toBeUndefined();
      expect(decision?.alternatives).toBeUndefined();
    });

    it('should extract title from heading if not in frontmatter', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `# Use TypeScript

## Context

We need type safety.
`;
      const decision = parser.parseDecisionContent(
        content,
        '/fake/decisions/decision-2 - Use-TypeScript.md'
      );
      expect(decision?.title).toBe('Use TypeScript');
      expect(decision?.context).toBe('We need type safety.');
    });

    it('should fall back to filename-based title', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `## Context

Some context.
`;
      const decision = parser.parseDecisionContent(
        content,
        '/fake/decisions/decision-1 - Use-Docker.md'
      );
      expect(decision?.title).toBe('Use Docker');
    });

    it('should sort decisions by ID number', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'decision-3 - Third.md',
        'decision-1 - First.md',
        'decision-2 - Second.md',
      ]);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('decision-1')) return `---\ntitle: First\nstatus: accepted\n---\n`;
        if (p.includes('decision-2')) return `---\ntitle: Second\nstatus: proposed\n---\n`;
        return `---\ntitle: Third\nstatus: rejected\n---\n`;
      });

      const parser = new BacklogParser('/fake/backlog');
      const decisions = await parser.getDecisions();

      expect(decisions).toHaveLength(3);
      expect(decisions[0].title).toBe('First');
      expect(decisions[1].title).toBe('Second');
      expect(decisions[2].title).toBe('Third');
    });

    it('should return empty array when decisions folder does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const parser = new BacklogParser('/fake/backlog');
      const decisions = await parser.getDecisions();
      expect(decisions).toEqual([]);
    });
  });

  describe('getDocuments', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty array when docs folder does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const parser = new BacklogParser('/fake/backlog');
      const docs = await parser.getDocuments();
      expect(docs).toEqual([]);
    });

    it('should sort documents by title', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('docs')) {
          return [
            { name: 'doc-2 - Zebra.md', isDirectory: () => false },
            { name: 'doc-1 - Alpha.md', isDirectory: () => false },
          ];
        }
        return [];
      });
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('doc-1')) return `---\ntitle: Alpha Guide\n---\nContent A`;
        return `---\ntitle: Zebra Guide\n---\nContent Z`;
      });

      const parser = new BacklogParser('/fake/backlog');
      const docs = await parser.getDocuments();

      expect(docs).toHaveLength(2);
      expect(docs[0].title).toBe('Alpha Guide');
      expect(docs[1].title).toBe('Zebra Guide');
    });

    it('should skip malformed document files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('docs')) {
          return [
            { name: 'doc-1 - Good.md', isDirectory: () => false },
            { name: 'not-a-doc.txt', isDirectory: () => false },
          ];
        }
        return [];
      });
      vi.mocked(fs.readFileSync).mockReturnValue(`---\ntitle: Good Document\n---\nContent`);

      const parser = new BacklogParser('/fake/backlog');
      const docs = await parser.getDocuments();

      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe('Good Document');
    });
  });

  describe('getDocument', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should find a document by ID', async () => {
      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'getDocuments').mockResolvedValue([
        {
          id: 'DOC-1',
          title: 'Test Doc',
          tags: [],
          content: 'content',
          filePath: '/fake/backlog/docs/doc-1.md',
        },
      ]);

      const doc = await parser.getDocument('DOC-1');
      expect(doc?.id).toBe('DOC-1');
    });

    it('should return undefined for non-existent document', async () => {
      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'getDocuments').mockResolvedValue([]);

      const doc = await parser.getDocument('DOC-999');
      expect(doc).toBeUndefined();
    });
  });

  describe('getDecision', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should find a decision by ID', async () => {
      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'getDecisions').mockResolvedValue([
        {
          id: 'DECISION-1',
          title: 'Test Decision',
          status: 'accepted',
          filePath: '/fake/backlog/decisions/decision-1.md',
        },
      ]);

      const decision = await parser.getDecision('DECISION-1');
      expect(decision?.id).toBe('DECISION-1');
    });

    it('should return undefined for non-existent decision', async () => {
      const parser = new BacklogParser('/fake/backlog');
      vi.spyOn(parser, 'getDecisions').mockResolvedValue([]);

      const decision = await parser.getDecision('DECISION-999');
      expect(decision).toBeUndefined();
    });
  });

  describe('Task file caching', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should not call readFileSync on second getTasks() with unchanged mtimes', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1 - My-Task.md']);
      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-1
title: My Task
status: To Do
---
`);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');

      // First call: should read from disk
      const tasks1 = await parser.getTasksFromFolder('tasks');
      expect(tasks1).toHaveLength(1);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);

      // Second call: same mtime, should use cache
      const tasks2 = await parser.getTasksFromFolder('tasks');
      expect(tasks2).toHaveLength(1);
      expect(tasks2[0].id).toBe('TASK-1');
      // readFileSync should NOT have been called again
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should re-read only the file whose mtime changed', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'task-1 - First.md',
        'task-2 - Second.md',
      ]);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('task-1')) return `---\nid: TASK-1\ntitle: First\nstatus: To Do\n---\n`;
        return `---\nid: TASK-2\ntitle: Second\nstatus: To Do\n---\n`;
      });
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');

      // First call: reads both files
      await parser.getTasksFromFolder('tasks');
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);

      // Change mtime of task-2 only
      vi.mocked(fs.statSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('task-2')) return { mtimeMs: 2000 } as fs.Stats;
        return { mtimeMs: 1000 } as fs.Stats;
      });
      vi.mocked(fs.readFileSync).mockClear();
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('task-1')) return `---\nid: TASK-1\ntitle: First\nstatus: To Do\n---\n`;
        return `---\nid: TASK-2\ntitle: Second Updated\nstatus: In Progress\n---\n`;
      });

      const tasks = await parser.getTasksFromFolder('tasks');
      // Only task-2 should have been re-read
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('task-2'), 'utf-8');
      // task-2 should have updated content
      const task2 = tasks.find((t) => t.id === 'TASK-2');
      expect(task2?.title).toBe('Second Updated');
      expect(task2?.status).toBe('In Progress');
    });

    it('should evict cache entries for deleted files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      // First call: two files
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'task-1 - First.md',
        'task-2 - Second.md',
      ]);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('task-1')) return `---\nid: TASK-1\ntitle: First\nstatus: To Do\n---\n`;
        return `---\nid: TASK-2\ntitle: Second\nstatus: To Do\n---\n`;
      });

      const parser = new BacklogParser('/fake/backlog');
      const tasks1 = await parser.getTasksFromFolder('tasks');
      expect(tasks1).toHaveLength(2);

      // Second call: task-2 deleted
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1 - First.md']);
      vi.mocked(fs.readFileSync).mockClear();

      const tasks2 = await parser.getTasksFromFolder('tasks');
      expect(tasks2).toHaveLength(1);
      expect(tasks2[0].id).toBe('TASK-1');
      // task-1 should have come from cache (not re-read)
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should force full re-read after invalidateTaskCache()', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['task-1 - My-Task.md']);
      vi.mocked(fs.readFileSync).mockReturnValue(`---
id: TASK-1
title: My Task
status: To Do
---
`);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');
      await parser.getTasksFromFolder('tasks');
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);

      // Invalidate and re-read
      parser.invalidateTaskCache();
      vi.mocked(fs.readFileSync).mockClear();

      await parser.getTasksFromFolder('tasks');
      // Should have re-read since cache was cleared
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should invalidate only a specific file path', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'task-1 - First.md',
        'task-2 - Second.md',
      ]);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('task-1')) return `---\nid: TASK-1\ntitle: First\nstatus: To Do\n---\n`;
        return `---\nid: TASK-2\ntitle: Second\nstatus: To Do\n---\n`;
      });
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      const parser = new BacklogParser('/fake/backlog');
      await parser.getTasksFromFolder('tasks');
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);

      // Invalidate only task-1
      parser.invalidateTaskCache('/fake/backlog/tasks/task-1 - First.md');
      vi.mocked(fs.readFileSync).mockClear();

      await parser.getTasksFromFolder('tasks');
      // Only task-1 should have been re-read (task-2 from cache)
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('task-1'), 'utf-8');
    });

    it('should cache tasks across different folders independently', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats);

      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dirPath: string) => {
        if (String(dirPath).endsWith('tasks')) return ['task-1 - Active.md'];
        if (String(dirPath).endsWith('drafts')) return ['draft-1 - Draft.md'];
        return [];
      });
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.includes('task-1')) return `---\nid: TASK-1\ntitle: Active\nstatus: To Do\n---\n`;
        return `---\nid: DRAFT-1\ntitle: Draft\nstatus: Draft\n---\n`;
      });

      const parser = new BacklogParser('/fake/backlog');

      // Read tasks folder
      await parser.getTasksFromFolder('tasks');
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);

      // Read drafts folder
      await parser.getTasksFromFolder('drafts');
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);

      vi.mocked(fs.readFileSync).mockClear();

      // Re-read both - both should be cached
      await parser.getTasksFromFolder('tasks');
      await parser.getTasksFromFolder('drafts');
      expect(fs.readFileSync).not.toHaveBeenCalled();
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

  describe('blank line preservation', () => {
    it('should preserve blank lines between paragraphs in description with markers', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First paragraph.

Second paragraph.

Third paragraph.
<!-- SECTION:DESCRIPTION:END -->
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toBe('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.');
    });

    it('should preserve blank lines between paragraphs in description without markers', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

First paragraph.

Second paragraph.

## Acceptance Criteria
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toBe('First paragraph.\n\nSecond paragraph.');
    });

    it('should preserve blank lines in implementation notes', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Implementation Notes

First note.

Second note.
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.implementationNotes).toBe('First note.\n\nSecond note.');
    });

    it('should preserve blank lines in plan', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Implementation Plan

Step 1.

Step 2.
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.implementationPlan).toBe('Step 1.\n\nStep 2.');
    });

    it('should preserve blank lines in final summary', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Final Summary

Para one.

Para two.
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.finalSummary).toBe('Para one.\n\nPara two.');
    });

    it('should not start collecting blank lines before first content line', () => {
      const parser = new BacklogParser('/fake/path');
      const content = `---
id: TASK-1
title: Test
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Actual content starts here.
<!-- SECTION:DESCRIPTION:END -->
`;
      const task = parser.parseTaskContent(content, '/fake/path/task-1.md');
      expect(task?.description).toBe('Actual content starts here.');
    });
  });
});
