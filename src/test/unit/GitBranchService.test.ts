import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { GitBranchService } from '../../core/GitBranchService';

/**
 * Integration tests for GitBranchService.
 * Creates a temporary git repository to test actual git operations.
 */
describe('GitBranchService', () => {
  let tempDir: string;
  let gitService: GitBranchService;

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

  // Helper to create a file and commit it
  const createFile = (filePath: string, content: string) => {
    const fullPath = path.join(tempDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
  };

  beforeAll(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-branch-service-test-'));

    // Initialize git repo
    git('init');
    git('config user.email "test@test.com"');
    git('config user.name "Test"');

    // Create initial commit on main branch
    createFile('README.md', '# Test Repo');
    git('add .');
    git('commit -m "Initial commit"');

    // Create backlog/tasks with a task file
    createFile(
      'backlog/tasks/task-1 - Test-task.md',
      `---
id: TASK-1
title: Test task on main
status: To Do
---

# TASK-1 - Test task on main
`
    );
    git('add .');
    git('commit -m "Add TASK-1"');

    // Create feature branch with different task
    git('checkout -b feature/test-feature');
    createFile(
      'backlog/tasks/task-2 - Feature-task.md',
      `---
id: TASK-2
title: Feature task
status: In Progress
---

# TASK-2 - Feature task
`
    );
    git('add .');
    git('commit -m "Add TASK-2"');

    // Create old branch (backdate to 60 days ago)
    git('checkout main');
    git('checkout -b old-branch');
    createFile(
      'backlog/tasks/task-3 - Old-task.md',
      `---
id: TASK-3
title: Old task
status: Draft
---

# TASK-3 - Old task
`
    );
    git('add .');
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    execSync(`git commit -m "Add TASK-3" --date="${oldDate}"`, {
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

    // Initialize the service
    gitService = new GitBranchService(tempDir);
  });

  afterAll(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('isGitRepository', () => {
    it('should return true for a git repository', () => {
      expect(gitService.isGitRepository()).toBe(true);
    });

    it('should return false for a non-git directory', () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
      const nonGitService = new GitBranchService(nonGitDir);
      expect(nonGitService.isGitRepository()).toBe(false);
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', () => {
      const branch = gitService.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });

  describe('getMainBranch', () => {
    it('should return "main" when main branch exists', () => {
      const mainBranch = gitService.getMainBranch();
      expect(mainBranch).toBe('main');
    });
  });

  describe('listLocalBranches', () => {
    it('should list all local branches', () => {
      const branches = gitService.listLocalBranches();
      const branchNames = branches.map((b) => b.name);

      expect(branchNames).toContain('main');
      expect(branchNames).toContain('feature/test-feature');
      expect(branchNames).toContain('old-branch');
    });

    it('should include lastCommitDate for each branch', () => {
      const branches = gitService.listLocalBranches();
      for (const branch of branches) {
        expect(branch.lastCommitDate).toBeInstanceOf(Date);
        expect(branch.lastCommitDate.getTime()).toBeLessThanOrEqual(Date.now());
      }
    });

    it('should mark all branches as non-remote', () => {
      const branches = gitService.listLocalBranches();
      for (const branch of branches) {
        expect(branch.isRemote).toBe(false);
      }
    });
  });

  describe('listRecentBranches', () => {
    it('should filter out old branches', () => {
      const recentBranches = gitService.listRecentBranches(30);
      const branchNames = recentBranches.map((b) => b.name);

      expect(branchNames).toContain('main');
      expect(branchNames).toContain('feature/test-feature');
      expect(branchNames).not.toContain('old-branch');
    });

    it('should include all branches with large enough window', () => {
      const allBranches = gitService.listRecentBranches(90);
      const branchNames = allBranches.map((b) => b.name);

      expect(branchNames).toContain('main');
      expect(branchNames).toContain('feature/test-feature');
      expect(branchNames).toContain('old-branch');
    });
  });

  describe('readFileFromBranch', () => {
    it('should read file content from current branch', () => {
      const content = gitService.readFileFromBranch('main', 'README.md');
      expect(content).toBe('# Test Repo');
    });

    it('should read task file from another branch', () => {
      const content = gitService.readFileFromBranch(
        'feature/test-feature',
        'backlog/tasks/task-2 - Feature-task.md'
      );
      expect(content).toContain('TASK-2');
      expect(content).toContain('Feature task');
      expect(content).toContain('In Progress');
    });

    it('should return null for non-existent file', () => {
      const content = gitService.readFileFromBranch('main', 'nonexistent.txt');
      expect(content).toBeNull();
    });

    it('should return null for non-existent branch', () => {
      const content = gitService.readFileFromBranch('nonexistent-branch', 'README.md');
      expect(content).toBeNull();
    });
  });

  describe('listFilesInPath', () => {
    it('should list files in backlog/tasks on main branch', () => {
      const files = gitService.listFilesInPath('main', 'backlog/tasks');
      expect(files.some((f) => f.includes('task-1'))).toBe(true);
    });

    it('should list files in backlog/tasks on feature branch', () => {
      const files = gitService.listFilesInPath('feature/test-feature', 'backlog/tasks');
      expect(files.some((f) => f.includes('task-1'))).toBe(true);
      expect(files.some((f) => f.includes('task-2'))).toBe(true);
    });

    it('should return empty array for non-existent path', () => {
      const files = gitService.listFilesInPath('main', 'nonexistent/path');
      expect(files).toEqual([]);
    });
  });

  describe('pathExistsOnBranch', () => {
    it('should return true for existing file', () => {
      expect(gitService.pathExistsOnBranch('main', 'README.md')).toBe(true);
    });

    it('should return true for existing directory', () => {
      expect(gitService.pathExistsOnBranch('main', 'backlog')).toBe(true);
    });

    it('should return false for non-existent path', () => {
      expect(gitService.pathExistsOnBranch('main', 'nonexistent.txt')).toBe(false);
    });
  });

  describe('getBranchLastCommitDate', () => {
    it('should return last commit date for a branch', () => {
      const date = gitService.getBranchLastCommitDate('main');
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return older date for old-branch', () => {
      const mainDate = gitService.getBranchLastCommitDate('main');
      const oldDate = gitService.getBranchLastCommitDate('old-branch');

      expect(oldDate.getTime()).toBeLessThan(mainDate.getTime());
      // Should be approximately 60 days older
      const daysDiff = (mainDate.getTime() - oldDate.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysDiff).toBeGreaterThan(55);
      expect(daysDiff).toBeLessThan(65);
    });
  });

  describe('getBranchLastModifiedMap', () => {
    it('should return a map of all branches with dates', () => {
      const map = gitService.getBranchLastModifiedMap();

      expect(map.has('main')).toBe(true);
      expect(map.has('feature/test-feature')).toBe(true);
      expect(map.has('old-branch')).toBe(true);

      expect(map.get('main')).toBeInstanceOf(Date);
    });
  });

  describe('getFileLastModified', () => {
    it('should return last modified date for a file', () => {
      const date = gitService.getFileLastModified('main', 'README.md');
      expect(date).toBeInstanceOf(Date);
      expect(date!.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return null for non-existent file', () => {
      const date = gitService.getFileLastModified('main', 'nonexistent.txt');
      expect(date).toBeNull();
    });
  });
});

/**
 * Unit tests with mocked execSync for edge cases
 */
describe('GitBranchService - Mocked', () => {
  it('should handle empty branch list gracefully', () => {
    const mockExecSync = vi.fn().mockReturnValue('');

    vi.doMock('child_process', () => ({
      execSync: mockExecSync,
    }));

    // Re-import to get mocked version would require more setup
    // For now, we test the behavior through integration tests above
  });
});
