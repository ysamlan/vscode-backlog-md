import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Integration tests for cross-branch functionality.
 *
 * These tests create a temporary git repository with multiple branches
 * and task files to verify cross-branch detection and filtering.
 */
describe('Cross-Branch Integration', () => {
  let tempDir: string;
  let backlogDir: string;

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
    fs.writeFileSync(
      path.join(taskDir, `${id.toLowerCase()} - ${title.replace(/\s+/g, '-')}.md`),
      content
    );
  };

  beforeAll(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-test-'));
    backlogDir = path.join(tempDir, 'backlog');
    fs.mkdirSync(backlogDir);

    // Initialize git repo
    git('init -b main');
    git('config user.email "test@test.com"');
    git('config user.name "Test"');

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
    // Backdate commit to 60 days ago
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
  });

  afterAll(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Git Repository Setup', () => {
    it('should have created a valid git repository', () => {
      expect(fs.existsSync(path.join(tempDir, '.git'))).toBe(true);
    });

    it('should have main branch with TASK-1', () => {
      const tasksDir = path.join(backlogDir, 'tasks');
      const files = fs.readdirSync(tasksDir);
      expect(files.some((f) => f.includes('task-1'))).toBe(true);
    });

    it('should have three branches', () => {
      const branches = execSync('git branch', { cwd: tempDir, encoding: 'utf-8' });
      expect(branches).toContain('main');
      expect(branches).toContain('feature/new-feature');
      expect(branches).toContain('old-feature');
    });
  });

  describe('Branch Task Discovery', () => {
    it('should find task file on current branch', () => {
      const tasksDir = path.join(backlogDir, 'tasks');
      const files = fs.readdirSync(tasksDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should be able to read task from another branch', () => {
      // Use git show to read file from feature branch
      const content = execSync(
        'git show feature/new-feature:backlog/tasks/task-2\\ -\\ Feature-branch-task.md',
        {
          cwd: tempDir,
          encoding: 'utf-8',
        }
      );
      expect(content).toContain('TASK-2');
      expect(content).toContain('Feature branch task');
      expect(content).toContain('In Progress');
    });

    it('should be able to list task files on another branch', () => {
      const files = execSync('git ls-tree --name-only feature/new-feature backlog/tasks/', {
        cwd: tempDir,
        encoding: 'utf-8',
      });
      expect(files).toContain('task-2');
    });
  });

  describe('Branch Age Filtering', () => {
    it('should identify branch last commit date', () => {
      // Get last commit date for each branch
      const getLastCommitDate = (branch: string) => {
        const timestamp = execSync(`git log -1 --format=%ct ${branch}`, {
          cwd: tempDir,
          encoding: 'utf-8',
        }).trim();
        return new Date(parseInt(timestamp, 10) * 1000);
      };

      const mainDate = getLastCommitDate('main');
      const featureDate = getLastCommitDate('feature/new-feature');
      const oldDate = getLastCommitDate('old-feature');

      // Main and feature should be recent (within last day)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(mainDate.getTime()).toBeGreaterThan(oneDayAgo.getTime());
      expect(featureDate.getTime()).toBeGreaterThan(oneDayAgo.getTime());

      // Old branch should be older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(oldDate.getTime()).toBeLessThan(thirtyDaysAgo.getTime());
    });

    it('should filter branches by activeBranchDays', () => {
      const activeBranchDays = 30;
      const cutoffDate = new Date(Date.now() - activeBranchDays * 24 * 60 * 60 * 1000);

      // Get all local branches with their last commit dates
      const branchesOutput = execSync(
        'git for-each-ref --format="%(refname:short) %(committerdate:unix)" refs/heads/',
        { cwd: tempDir, encoding: 'utf-8' }
      );

      const activeBranches: string[] = [];
      const inactiveBranches: string[] = [];

      branchesOutput
        .trim()
        .split('\n')
        .forEach((line) => {
          const [branch, timestamp] = line.split(' ');
          const commitDate = new Date(parseInt(timestamp, 10) * 1000);
          if (commitDate.getTime() > cutoffDate.getTime()) {
            activeBranches.push(branch);
          } else {
            inactiveBranches.push(branch);
          }
        });

      expect(activeBranches).toContain('main');
      expect(activeBranches).toContain('feature/new-feature');
      expect(inactiveBranches).toContain('old-feature');
    });
  });

  describe('Cross-Branch Task State', () => {
    it('should detect same task exists on multiple branches with different states', () => {
      // Create a branch where TASK-1 has different status
      git('checkout -b task-1-in-progress');
      const taskPath = path.join(backlogDir, 'tasks');
      const taskFile = fs.readdirSync(taskPath).find((f) => f.includes('task-1'));
      expect(taskFile).toBeDefined();

      const content = fs.readFileSync(path.join(taskPath, taskFile!), 'utf-8');
      const updatedContent = content.replace('status: To Do', 'status: In Progress');
      fs.writeFileSync(path.join(taskPath, taskFile!), updatedContent);
      git('add .');
      git('commit -m "Update TASK-1 to In Progress"');
      git('checkout main');

      // Now read TASK-1 from both branches using git show with proper quoting
      const mainContent = execSync(`git show "main:backlog/tasks/${taskFile}"`, {
        cwd: tempDir,
        encoding: 'utf-8',
      });
      const branchContent = execSync(`git show "task-1-in-progress:backlog/tasks/${taskFile}"`, {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      expect(mainContent).toContain('status: To Do');
      expect(branchContent).toContain('status: In Progress');
    });
  });
});

/**
 * Unit tests for cross-branch task resolution logic.
 * These test the resolution strategies without needing a real git repo.
 */
describe('Task Resolution Strategies', () => {
  interface TaskState {
    id: string;
    status: string;
    lastModified: Date;
    branch: string;
  }

  // Mock implementation of resolution strategies
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

    // most_progressed: Done > In Progress > To Do > Draft
    const statusOrder: Record<string, number> = {
      Draft: 0,
      'To Do': 1,
      'In Progress': 2,
      Done: 3,
    };

    return tasks.reduce((mostProgressed, task) => {
      const currentProgress = statusOrder[task.status] ?? 0;
      const bestProgress = statusOrder[mostProgressed.status] ?? 0;
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
      expect(result.status).toBe('To Do'); // Even though it's less progressed
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
      expect(result.status).toBe('Done'); // Even though it's older
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
          expect(result.status).toBe(statuses[j]); // Higher index = more progressed
        }
      }
    });
  });
});
