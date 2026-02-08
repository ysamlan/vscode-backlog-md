import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

describe('setup-cross-branch-demo script', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    createdDirs.length = 0;
  });

  it('creates a deterministic local cross-branch demo workspace', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-branch-demo-script-'));
    createdDirs.push(tempDir);

    const workspaceDir = path.join(tempDir, 'workspace');
    const scriptPath = path.resolve(process.cwd(), 'scripts/setup-cross-branch-demo.sh');

    execFileSync('bash', [scriptPath, workspaceDir, '--reset', '--quiet'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    expect(fs.existsSync(path.join(workspaceDir, '.git'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, 'backlog', 'config.yml'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, 'backlog', 'tasks'))).toBe(true);

    const config = fs.readFileSync(path.join(workspaceDir, 'backlog', 'config.yml'), 'utf-8');
    expect(config).toContain('check_active_branches: true');

    const branches = execFileSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: workspaceDir,
      encoding: 'utf-8',
    });
    expect(branches).toContain('main');
    expect(branches).toContain('feature/cross-branch-demo');

    const mainTasks = fs.readdirSync(path.join(workspaceDir, 'backlog', 'tasks'));
    expect(mainTasks.some((file) => file.includes('task-1'))).toBe(true);
    expect(mainTasks.some((file) => file.includes('task-900'))).toBe(false);

    const branchOnlyTask = execFileSync(
      'git',
      ['show', 'feature/cross-branch-demo:backlog/tasks/task-900 - Branch-only-task.md'],
      {
        cwd: workspaceDir,
        encoding: 'utf-8',
      }
    );
    expect(branchOnlyTask).toContain('TASK-900');
  });
});
