/**
 * Test workspace fixture management.
 *
 * Copies the test-workspace fixture to a temporary directory for isolation,
 * and provides reset/cleanup utilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const FIXTURE_WORKSPACE = path.resolve(__dirname, '../../../test/e2e/fixtures/test-workspace');

/** Recursively copy a directory */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Create a fresh copy of the test workspace in a temp directory */
export function createTestWorkspace(runId?: string): string {
  const id = runId ?? `cdp-${Date.now()}`;
  const tmpDir = path.join(os.tmpdir(), id);
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  copyDirSync(FIXTURE_WORKSPACE, tmpDir);
  return tmpDir;
}

/** Reset the task files in the workspace back to fixture state */
export function resetTestWorkspace(workspacePath: string): void {
  const tasksDir = path.join(workspacePath, 'backlog', 'tasks');
  const fixtureTasksDir = path.join(FIXTURE_WORKSPACE, 'backlog', 'tasks');

  // Remove current tasks
  if (fs.existsSync(tasksDir)) {
    fs.rmSync(tasksDir, { recursive: true, force: true });
  }
  // Copy fixture tasks back
  copyDirSync(fixtureTasksDir, tasksDir);

  // Also reset completed/ and archive/ if they exist
  for (const subdir of ['completed', 'archive']) {
    const destDir = path.join(workspacePath, 'backlog', subdir);
    const srcDir = path.join(FIXTURE_WORKSPACE, 'backlog', subdir);
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    if (fs.existsSync(srcDir)) {
      copyDirSync(srcDir, destDir);
    }
  }
}

/** Remove the temp workspace directory */
export function cleanupTestWorkspace(workspacePath: string): void {
  try {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  } catch {
    // Best effort cleanup
  }
}

/** Get the path to a specific task file in the workspace */
export function taskFilePath(workspacePath: string, filename: string): string {
  return path.join(workspacePath, 'backlog', 'tasks', filename);
}
