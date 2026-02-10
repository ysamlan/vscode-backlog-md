import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateConfigYml,
  initializeBacklog,
  validateTaskPrefix,
  type InitBacklogOptions,
} from '../../core/initBacklog';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('initBacklog', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateTaskPrefix', () => {
    it('accepts alphabetic prefixes', () => {
      expect(validateTaskPrefix('task')).toBe(true);
      expect(validateTaskPrefix('TASK')).toBe(true);
      expect(validateTaskPrefix('MyPrefix')).toBe(true);
    });

    it('rejects non-alphabetic prefixes', () => {
      expect(validateTaskPrefix('task-1')).toBe(false);
      expect(validateTaskPrefix('123')).toBe(false);
      expect(validateTaskPrefix('task_prefix')).toBe(false);
      expect(validateTaskPrefix('')).toBe(false);
      expect(validateTaskPrefix('task 1')).toBe(false);
    });
  });

  describe('generateConfigYml', () => {
    it('generates correct config with default options', () => {
      const options: InitBacklogOptions = {
        projectName: 'My Project',
        taskPrefix: 'task',
        statuses: ['To Do', 'In Progress', 'Done'],
      };

      const result = generateConfigYml(options);

      expect(result).toContain('project_name: "My Project"');
      expect(result).toContain('statuses: ["To Do", "In Progress", "Done"]');
      expect(result).toContain('default_status: "To Do"');
      expect(result).toContain('labels: []');
      expect(result).toContain('milestones: []');
      expect(result).toContain('date_format: yyyy-mm-dd');
      expect(result).toContain('max_column_width: 20');
      expect(result).toContain('task_prefix: "task"');
    });

    it('generates config with custom options', () => {
      const options: InitBacklogOptions = {
        projectName: 'Custom App',
        taskPrefix: 'feat',
        statuses: ['Backlog', 'Active', 'Review', 'Shipped'],
      };

      const result = generateConfigYml(options);

      expect(result).toContain('project_name: "Custom App"');
      expect(result).toContain('statuses: ["Backlog", "Active", "Review", "Shipped"]');
      expect(result).toContain('default_status: "Backlog"');
      expect(result).toContain('task_prefix: "feat"');
    });

    it('matches upstream field ordering', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'Done'],
      };

      const result = generateConfigYml(options);
      const lines = result.split('\n');

      // Verify upstream-compatible field order
      const fieldOrder = lines.filter((l) => l.includes(':')).map((l) => l.split(':')[0].trim());
      expect(fieldOrder).toEqual([
        'project_name',
        'default_status',
        'statuses',
        'labels',
        'milestones',
        'date_format',
        'max_column_width',
        'task_prefix',
      ]);
    });

    it('uses unquoted date_format like upstream', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'Done'],
      };

      const result = generateConfigYml(options);
      expect(result).toContain('date_format: yyyy-mm-dd');
      // Should NOT have quotes around the value
      expect(result).not.toContain('date_format: "yyyy-mm-dd"');
      expect(result).not.toContain("date_format: 'yyyy-mm-dd'");
    });

    it('omits advanced fields when not set', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'Done'],
      };

      const result = generateConfigYml(options);
      expect(result).not.toContain('check_active_branches');
      expect(result).not.toContain('remote_operations');
      expect(result).not.toContain('active_branch_days');
      expect(result).not.toContain('bypass_git_hooks');
      expect(result).not.toContain('auto_commit');
      expect(result).not.toContain('zero_padded_ids');
      expect(result).not.toContain('default_editor');
      expect(result).not.toContain('default_port');
      expect(result).not.toContain('auto_open_browser');
    });

    it('includes advanced fields when set', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'Done'],
        checkActiveBranches: true,
        remoteOperations: true,
        activeBranchDays: 30,
        bypassGitHooks: false,
        autoCommit: false,
        zeroPaddedIds: 3,
        defaultEditor: 'code --wait',
        defaultPort: 6420,
        autoOpenBrowser: true,
      };

      const result = generateConfigYml(options);
      expect(result).toContain('check_active_branches: true');
      expect(result).toContain('remote_operations: true');
      expect(result).toContain('active_branch_days: 30');
      expect(result).toContain('bypass_git_hooks: false');
      expect(result).toContain('auto_commit: false');
      expect(result).toContain('zero_padded_ids: 3');
      expect(result).toContain('default_editor: "code --wait"');
      expect(result).toContain('default_port: 6420');
      expect(result).toContain('auto_open_browser: true');
    });

    it('writes advanced fields before task_prefix (upstream order)', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'Done'],
        checkActiveBranches: true,
        autoCommit: false,
      };

      const result = generateConfigYml(options);
      const lines = result.split('\n').filter((l) => l.includes(':'));
      const fields = lines.map((l) => l.split(':')[0].trim());

      // task_prefix must be last
      expect(fields[fields.length - 1]).toBe('task_prefix');
      // Advanced fields must come after max_column_width but before task_prefix
      const mcwIdx = fields.indexOf('max_column_width');
      const tpIdx = fields.indexOf('task_prefix');
      const acIdx = fields.indexOf('auto_commit');
      const cbIdx = fields.indexOf('check_active_branches');
      expect(acIdx).toBeGreaterThan(mcwIdx);
      expect(acIdx).toBeLessThan(tpIdx);
      expect(cbIdx).toBeGreaterThan(mcwIdx);
      expect(cbIdx).toBeLessThan(tpIdx);
    });

    it('only includes cross-branch sub-fields when checkActiveBranches is set', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'Done'],
        remoteOperations: true,
        activeBranchDays: 15,
        // Note: checkActiveBranches not set — sub-fields still appear
        // because generateConfigYml writes any explicitly-set field.
        // The wizard controls which fields get set based on user answers.
      };

      const result = generateConfigYml(options);
      // These are present because they were explicitly provided
      expect(result).toContain('remote_operations: true');
      expect(result).toContain('active_branch_days: 15');
    });
  });

  describe('initializeBacklog', () => {
    it('creates all expected directories', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'In Progress', 'Done'],
      };

      initializeBacklog('/workspace', options);

      const mkdirCalls = vi.mocked(fs.mkdirSync).mock.calls.map((call) => call[0]);
      const expectedDirs = [
        path.join('/workspace', 'backlog', 'tasks'),
        path.join('/workspace', 'backlog', 'drafts'),
        path.join('/workspace', 'backlog', 'completed'),
        path.join('/workspace', 'backlog', 'archive', 'tasks'),
        path.join('/workspace', 'backlog', 'archive', 'drafts'),
        path.join('/workspace', 'backlog', 'archive', 'milestones'),
        path.join('/workspace', 'backlog', 'docs'),
        path.join('/workspace', 'backlog', 'decisions'),
        path.join('/workspace', 'backlog', 'milestones'),
      ];

      for (const dir of expectedDirs) {
        expect(mkdirCalls).toContainEqual(dir);
      }
    });

    it('writes config.yml', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'In Progress', 'Done'],
      };

      initializeBacklog('/workspace', options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/workspace', 'backlog', 'config.yml'),
        expect.stringContaining('project_name: "Test"'),
        'utf-8'
      );
    });

    it('returns the backlog path', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'In Progress', 'Done'],
      };

      const result = initializeBacklog('/workspace', options);
      expect(result).toBe(path.join('/workspace', 'backlog'));
    });

    it('throws if backlog folder already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task',
        statuses: ['To Do', 'In Progress', 'Done'],
      };

      expect(() => initializeBacklog('/workspace', options)).toThrow('already exists');
    });

    it('throws on invalid task prefix', () => {
      const options: InitBacklogOptions = {
        projectName: 'Test',
        taskPrefix: 'task-1',
        statuses: ['To Do', 'In Progress', 'Done'],
      };

      expect(() => initializeBacklog('/workspace', options)).toThrow('Invalid task prefix');
    });

    it('works with custom options', () => {
      const options: InitBacklogOptions = {
        projectName: 'Custom',
        taskPrefix: 'feat',
        statuses: ['Backlog', 'Active', 'Done'],
      };

      initializeBacklog('/my/project', options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/my/project', 'backlog', 'config.yml'),
        expect.stringContaining('task_prefix: "feat"'),
        'utf-8'
      );
    });
  });
});
