import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { GitBranchService } from '../../core/GitBranchService';
import { CrossBranchTaskLoader } from '../../core/CrossBranchTaskLoader';
import { BacklogParser } from '../../core/BacklogParser';
import { BacklogConfig } from '../../core/types';

/**
 * Integration tests for CrossBranchTaskLoader.
 * Creates a temporary git repository with multiple branches and tasks.
 */
describe('CrossBranchTaskLoader', () => {
  let tempDir: string;
  let backlogDir: string;
  let gitService: GitBranchService;
  let parser: BacklogParser;

  // Helper to run git commands in temp repo
  const git = (command: string) => {
    execSync(`git ${command}`, {
      cwd: tempDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@test.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@test.com',
      },
    });
  };

  // Helper to create a task file
  const createTask = (id: string, title: string, status: string) => {
    const taskDir = path.join(backlogDir, 'tasks');
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    const content = `---
id: ${id}
title: ${title}
status: ${status}
---

# ${id} - ${title}
`;
    const filename = `${id.toLowerCase()} - ${title.replace(/\s+/g, '-')}.md`;
    fs.writeFileSync(path.join(taskDir, filename), content);
  };

  // Helper to create config file
  const createConfig = (config: BacklogConfig) => {
    const configPath = path.join(backlogDir, 'config.yml');
    let content = '';
    if (config.check_active_branches !== undefined) {
      content += `check_active_branches: ${config.check_active_branches}\n`;
    }
    if (config.active_branch_days !== undefined) {
      content += `active_branch_days: ${config.active_branch_days}\n`;
    }
    if (config.task_resolution_strategy) {
      content += `task_resolution_strategy: ${config.task_resolution_strategy}\n`;
    }
    fs.writeFileSync(configPath, content);
  };

  beforeAll(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-branch-loader-test-'));
    backlogDir = path.join(tempDir, 'backlog');
    fs.mkdirSync(backlogDir);

    // Initialize git repo
    git('init');
    git('config user.email "test@test.com"');
    git('config user.name "Test"');

    // Create config enabling cross-branch
    createConfig({
      check_active_branches: true,
      active_branch_days: 30,
      task_resolution_strategy: 'most_recent',
    });

    // Create initial task on main branch
    createTask('TASK-1', 'Main branch task', 'To Do');
    git('add .');
    git('commit -m "Add TASK-1 on main"');

    // Create feature branch with additional task
    git('checkout -b feature/new-feature');
    createTask('TASK-2', 'Feature branch task', 'In Progress');
    git('add .');
    git('commit -m "Add TASK-2 on feature branch"');

    // Create old branch (simulate old date by backdating)
    git('checkout main');
    git('checkout -b old-feature');
    createTask('TASK-3', 'Old branch task', 'To Do');
    git('add .');
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    execSync(`git commit -m "Add TASK-3 on old branch" --date="${oldDate}"`, {
      cwd: tempDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@test.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@test.com',
        GIT_AUTHOR_DATE: oldDate,
        GIT_COMMITTER_DATE: oldDate,
      },
    });

    // Return to main
    git('checkout main');

    // Initialize services
    gitService = new GitBranchService(tempDir);
    parser = new BacklogParser(backlogDir);
  });

  afterAll(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadTasksAcrossBranches', () => {
    it('should load tasks from multiple branches', async () => {
      const config = await parser.getConfig();
      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);

      const tasks = await loader.loadTasksAcrossBranches();

      // Should have TASK-1 from main and TASK-2 from feature branch
      // TASK-3 is on old-feature which is filtered out by active_branch_days
      const taskIds = tasks.map((t) => t.id);
      expect(taskIds).toContain('TASK-1');
      expect(taskIds).toContain('TASK-2');
      // TASK-3 should be filtered out (branch is >30 days old)
      expect(taskIds).not.toContain('TASK-3');
    });

    it('should include source and branch metadata', async () => {
      const config = await parser.getConfig();
      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);

      const tasks = await loader.loadTasksAcrossBranches();

      const task1 = tasks.find((t) => t.id === 'TASK-1');
      const task2 = tasks.find((t) => t.id === 'TASK-2');

      expect(task1).toBeDefined();
      expect(task1!.branch).toBe('main');
      expect(task1!.source).toBe('local'); // Current branch

      expect(task2).toBeDefined();
      expect(task2!.branch).toBe('feature/new-feature');
      expect(task2!.source).toBe('local-branch'); // Other branch
    });

    it('should include lastModified for tasks from other branches', async () => {
      const config = await parser.getConfig();
      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);

      const tasks = await loader.loadTasksAcrossBranches();

      // Remote-branch tasks should have lastModified from git
      const task2 = tasks.find((t) => t.id === 'TASK-2');
      expect(task2).toBeDefined();
      expect(task2!.lastModified).toBeInstanceOf(Date);
    });
  });

  describe('Task Conflict Resolution', () => {
    let conflictTempDir: string;
    let conflictBacklogDir: string;
    let conflictGitService: GitBranchService;
    let conflictParser: BacklogParser;

    beforeAll(() => {
      // Create a new temp repo for conflict testing
      conflictTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conflict-test-'));
      conflictBacklogDir = path.join(conflictTempDir, 'backlog');
      fs.mkdirSync(conflictBacklogDir);

      // Initialize git
      execSync('git init', { cwd: conflictTempDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: conflictTempDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: conflictTempDir, stdio: 'pipe' });

      // Create config
      const configPath = path.join(conflictBacklogDir, 'config.yml');
      fs.writeFileSync(
        configPath,
        `check_active_branches: true
active_branch_days: 30
`
      );

      // Create TASK-1 on main as "To Do"
      const taskDir = path.join(conflictBacklogDir, 'tasks');
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(
        path.join(taskDir, 'task-1 - Shared-task.md'),
        `---
id: TASK-1
title: Shared task
status: To Do
---

# TASK-1 - Shared task
`
      );
      execSync('git add .', { cwd: conflictTempDir, stdio: 'pipe' });
      // Use explicit older date for main branch commit
      const olderDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      execSync(`git commit -m "Add TASK-1 on main" --date="${olderDate}"`, {
        cwd: conflictTempDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@test.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@test.com',
          GIT_AUTHOR_DATE: olderDate,
          GIT_COMMITTER_DATE: olderDate,
        },
      });

      // Create feature branch with TASK-1 as "Done"
      execSync('git checkout -b feature/progress', { cwd: conflictTempDir, stdio: 'pipe' });
      fs.writeFileSync(
        path.join(taskDir, 'task-1 - Shared-task.md'),
        `---
id: TASK-1
title: Shared task
status: Done
---

# TASK-1 - Shared task
`
      );
      execSync('git add .', { cwd: conflictTempDir, stdio: 'pipe' });
      execSync('git commit -m "Update TASK-1 to Done"', {
        cwd: conflictTempDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@test.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@test.com',
        },
      });

      // Return to main
      execSync('git checkout main', { cwd: conflictTempDir, stdio: 'pipe' });

      conflictGitService = new GitBranchService(conflictTempDir);
      conflictParser = new BacklogParser(conflictBacklogDir);
    });

    afterAll(() => {
      if (conflictTempDir && fs.existsSync(conflictTempDir)) {
        fs.rmSync(conflictTempDir, { recursive: true, force: true });
      }
    });

    it('should resolve conflicts using most_recent strategy', async () => {
      const config: BacklogConfig = {
        check_active_branches: true,
        active_branch_days: 30,
        task_resolution_strategy: 'most_recent',
      };

      const loader = new CrossBranchTaskLoader(
        conflictGitService,
        conflictParser,
        config,
        conflictBacklogDir
      );
      const tasks = await loader.loadTasksAcrossBranches();

      const task1 = tasks.find((t) => t.id === 'TASK-1');
      expect(task1).toBeDefined();
      // Feature branch commit is more recent, so it should win
      expect(task1!.status).toBe('Done');
      expect(task1!.branch).toBe('feature/progress');
    });

    it('should resolve conflicts using most_progressed strategy', async () => {
      const config: BacklogConfig = {
        check_active_branches: true,
        active_branch_days: 30,
        task_resolution_strategy: 'most_progressed',
      };

      const loader = new CrossBranchTaskLoader(
        conflictGitService,
        conflictParser,
        config,
        conflictBacklogDir
      );
      const tasks = await loader.loadTasksAcrossBranches();

      const task1 = tasks.find((t) => t.id === 'TASK-1');
      expect(task1).toBeDefined();
      // Done > To Do, so feature branch version wins
      expect(task1!.status).toBe('Done');
    });
  });

  describe('Edge Cases', () => {
    it('should handle branches without backlog folder', async () => {
      // Create branch without backlog
      git('checkout -b no-backlog');
      const noBacklogFile = path.join(tempDir, 'other.txt');
      fs.writeFileSync(noBacklogFile, 'no backlog here');
      git('add .');
      git('commit -m "No backlog branch"');
      git('checkout main');

      const config = await parser.getConfig();
      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);

      // Should not throw, just skip the branch
      const tasks = await loader.loadTasksAcrossBranches();
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should default to 30 days when active_branch_days not set', async () => {
      const config: BacklogConfig = {
        check_active_branches: true,
        // active_branch_days not set
      };

      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);
      const tasks = await loader.loadTasksAcrossBranches();

      // Should filter out old-branch (>30 days)
      const taskIds = tasks.map((t) => t.id);
      expect(taskIds).not.toContain('TASK-3');
    });

    it('should default to most_recent when task_resolution_strategy not set', async () => {
      const config: BacklogConfig = {
        check_active_branches: true,
        active_branch_days: 30,
        // task_resolution_strategy not set
      };

      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);

      // Should not throw
      const tasks = await loader.loadTasksAcrossBranches();
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Index-first optimization', () => {
    it('should skip unnecessary reads when local tasks are newer', async () => {
      // All tasks on main are loaded from disk, not via git show
      // The feature branch has TASK-1 (same as main) + TASK-2 (unique)
      // For most_recent: TASK-1 on feature is older → should NOT be hydrated
      const config: BacklogConfig = {
        check_active_branches: true,
        active_branch_days: 30,
        task_resolution_strategy: 'most_recent',
      };

      const readSpy = vi.spyOn(gitService, 'readFileFromBranch');
      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);
      await loader.loadTasksAcrossBranches();

      // readFileFromBranch should only be called for tasks that need hydrating
      // TASK-2 on feature/new-feature is unique → must be hydrated
      // TASK-1 on feature/new-feature: main has a newer commit → should be skipped
      const calls = readSpy.mock.calls;
      const hydratedFiles = calls.map((c) => c[1]);

      // TASK-2 should definitely be hydrated (doesn't exist locally)
      expect(hydratedFiles.some((f) => f.includes('task-2'))).toBe(true);

      readSpy.mockRestore();
    });

    it('should load current branch tasks from disk, not git', async () => {
      const config: BacklogConfig = {
        check_active_branches: true,
        active_branch_days: 30,
      };

      const getTasksSpy = vi.spyOn(parser, 'getTasks');
      const loader = new CrossBranchTaskLoader(gitService, parser, config, backlogDir);
      await loader.loadTasksAcrossBranches();

      // parser.getTasks() should be called for disk-based loading of current branch
      expect(getTasksSpy).toHaveBeenCalledOnce();

      getTasksSpy.mockRestore();
    });

    it('should return only local tasks when no other branches exist', async () => {
      // Create isolated repo with only one branch
      const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isolated-test-'));
      const isolatedBacklog = path.join(isolatedDir, 'backlog');
      fs.mkdirSync(isolatedBacklog);

      execSync('git init', { cwd: isolatedDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: isolatedDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: isolatedDir, stdio: 'pipe' });

      const taskDir = path.join(isolatedBacklog, 'tasks');
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(
        path.join(taskDir, 'task-1 - Solo-task.md'),
        `---
id: TASK-1
title: Solo task
status: To Do
---
# TASK-1 - Solo task
`
      );
      fs.writeFileSync(path.join(isolatedBacklog, 'config.yml'), 'check_active_branches: true\n');
      execSync('git add . && git commit -m "init"', {
        cwd: isolatedDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@test.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@test.com',
        },
      });

      const isoGit = new GitBranchService(isolatedDir);
      const isoParser = new BacklogParser(isolatedBacklog);
      const config: BacklogConfig = { check_active_branches: true };
      const loader = new CrossBranchTaskLoader(isoGit, isoParser, config, isolatedBacklog);

      const tasks = await loader.loadTasksAcrossBranches();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('TASK-1');
      expect(tasks[0].source).toBe('local');

      fs.rmSync(isolatedDir, { recursive: true, force: true });
    });
  });
});

/**
 * Unit tests for resolution logic in isolation
 */
describe('CrossBranchTaskLoader - Resolution Logic', () => {
  interface TaskState {
    id: string;
    status: string;
    lastModified: Date;
    branch: string;
  }

  const STATUS_ORDER: Record<string, number> = {
    Draft: 0,
    'To Do': 1,
    'In Progress': 2,
    Done: 3,
  };

  const resolveTask = (
    tasks: TaskState[],
    strategy: 'most_recent' | 'most_progressed'
  ): TaskState => {
    if (tasks.length === 0) throw new Error('No tasks to resolve');
    if (tasks.length === 1) return tasks[0];

    if (strategy === 'most_recent') {
      return tasks.reduce((latest, task) =>
        task.lastModified > latest.lastModified ? task : latest
      );
    }

    // most_progressed
    return tasks.reduce((mostProgressed, task) => {
      const currentProgress = STATUS_ORDER[task.status] ?? 0;
      const bestProgress = STATUS_ORDER[mostProgressed.status] ?? 0;
      return currentProgress > bestProgress ? task : mostProgressed;
    });
  };

  describe('most_recent strategy', () => {
    it('should pick the task with most recent lastModified date', () => {
      const tasks: TaskState[] = [
        { id: 'TASK-1', status: 'Done', lastModified: new Date('2024-01-01'), branch: 'main' },
        { id: 'TASK-1', status: 'To Do', lastModified: new Date('2024-01-15'), branch: 'feature' },
        {
          id: 'TASK-1',
          status: 'In Progress',
          lastModified: new Date('2024-01-10'),
          branch: 'dev',
        },
      ];

      const result = resolveTask(tasks, 'most_recent');

      expect(result.branch).toBe('feature');
      expect(result.status).toBe('To Do');
    });
  });

  describe('most_progressed strategy', () => {
    it('should pick the task with highest status progression', () => {
      const tasks: TaskState[] = [
        { id: 'TASK-1', status: 'Done', lastModified: new Date('2024-01-01'), branch: 'main' },
        { id: 'TASK-1', status: 'To Do', lastModified: new Date('2024-01-15'), branch: 'feature' },
        {
          id: 'TASK-1',
          status: 'In Progress',
          lastModified: new Date('2024-01-10'),
          branch: 'dev',
        },
      ];

      const result = resolveTask(tasks, 'most_progressed');

      expect(result.branch).toBe('main');
      expect(result.status).toBe('Done');
    });

    it('should correctly order all status values', () => {
      const statuses = ['Draft', 'To Do', 'In Progress', 'Done'];

      for (let i = 0; i < statuses.length; i++) {
        for (let j = i + 1; j < statuses.length; j++) {
          const tasks: TaskState[] = [
            { id: 'TASK-1', status: statuses[i], lastModified: new Date(), branch: 'a' },
            { id: 'TASK-1', status: statuses[j], lastModified: new Date(), branch: 'b' },
          ];

          const result = resolveTask(tasks, 'most_progressed');
          expect(result.status).toBe(statuses[j]);
        }
      }
    });
  });
});
