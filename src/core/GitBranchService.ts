import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Information about a git branch
 */
export interface BranchInfo {
  name: string;
  lastCommitDate: Date;
  isRemote: boolean;
}

/**
 * Service for cross-branch git operations using child_process.
 * Uses async execFile with args array (no shell) for safety and performance.
 */
export class GitBranchService {
  constructor(private workspaceRoot: string) {}

  /**
   * Check if the workspace is a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const output = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return output.trim();
  }

  /**
   * Get the main/default branch name (main or master)
   */
  async getMainBranch(): Promise<string> {
    const branches = await this.listLocalBranches();
    const branchNames = branches.map((b) => b.name);

    if (branchNames.includes('main')) return 'main';
    if (branchNames.includes('master')) return 'master';

    return branchNames[0] || 'main';
  }

  /**
   * List all local branches with their last commit dates
   */
  async listLocalBranches(): Promise<BranchInfo[]> {
    try {
      const output = await this.execGit([
        'for-each-ref',
        '--format=%(refname:short) %(committerdate:unix)',
        'refs/heads/',
      ]);

      if (!output.trim()) {
        return [];
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.trim().split(' ');
          const timestamp = parseInt(parts[parts.length - 1], 10);
          const name = parts.slice(0, -1).join(' ');

          return {
            name,
            lastCommitDate: new Date(timestamp * 1000),
            isRemote: false,
          };
        });
    } catch (error) {
      console.error('[GitBranchService] Error listing branches:', error);
      return [];
    }
  }

  /**
   * Filter branches by age (only include branches with commits within the last N days)
   */
  async listRecentBranches(daysAgo: number): Promise<BranchInfo[]> {
    const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const branches = await this.listLocalBranches();

    return branches.filter((branch) => branch.lastCommitDate.getTime() > cutoffDate.getTime());
  }

  /**
   * Read a file from a specific branch without checking it out
   * @returns File content or null if file doesn't exist on that branch
   */
  async readFileFromBranch(branch: string, filePath: string): Promise<string | null> {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const output = await this.execGit(['show', `${branch}:${normalizedPath}`]);
      return output;
    } catch {
      return null;
    }
  }

  /**
   * List files in a directory on a specific branch
   * @returns Array of file names (not full paths)
   */
  async listFilesInPath(branch: string, dirPath: string): Promise<string[]> {
    try {
      let normalizedPath = dirPath.replace(/\\/g, '/');
      if (!normalizedPath.endsWith('/')) {
        normalizedPath += '/';
      }

      const output = await this.execGit(['ls-tree', '--name-only', branch, normalizedPath]);

      if (!output.trim()) {
        return [];
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('/');
          return parts[parts.length - 1];
        });
    } catch {
      return [];
    }
  }

  /**
   * Check if a path exists on a specific branch
   */
  async pathExistsOnBranch(branch: string, filePath: string): Promise<boolean> {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      await this.execGit(['cat-file', '-e', `${branch}:${normalizedPath}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the last commit date for a specific branch
   */
  async getBranchLastCommitDate(branch: string): Promise<Date> {
    const output = await this.execGit(['log', '-1', `--format=%ct`, branch]);
    return new Date(parseInt(output.trim(), 10) * 1000);
  }

  /**
   * Get a map of branch names to their last commit dates
   */
  async getBranchLastModifiedMap(): Promise<Map<string, Date>> {
    const branches = await this.listLocalBranches();
    const map = new Map<string, Date>();

    for (const branch of branches) {
      map.set(branch.name, branch.lastCommitDate);
    }

    return map;
  }

  /**
   * Get the last modified time of a file on a specific branch
   */
  async getFileLastModified(branch: string, filePath: string): Promise<Date | null> {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const output = await this.execGit([
        'log',
        '-1',
        '--format=%ct',
        branch,
        '--',
        normalizedPath,
      ]);

      const timestamp = output.trim();
      if (!timestamp) {
        return null;
      }

      return new Date(parseInt(timestamp, 10) * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Get modification timestamps for all files in a directory on a branch in one git call.
   * Returns Map<filename, Date> (just filenames, not full paths).
   * Much more efficient than individual getFileLastModified calls.
   */
  async getFileModifiedMap(branch: string, dirPath: string): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();

    try {
      let normalizedPath = dirPath.replace(/\\/g, '/');
      if (!normalizedPath.endsWith('/')) {
        normalizedPath += '/';
      }

      const output = await this.execGit([
        'log',
        '--pretty=format:%ct%x00',
        '--name-only',
        '-z',
        branch,
        '--',
        normalizedPath,
      ]);

      // Parse null-delimited output:
      // Format: timestamp\0 file1\0 file2\0 ... timestamp\0 file1\0 ...
      const parts = output.split('\0').filter(Boolean);
      let i = 0;

      while (i < parts.length) {
        const timestampStr = parts[i]?.trim();
        if (timestampStr && /^\d+$/.test(timestampStr)) {
          const date = new Date(Number(timestampStr) * 1000);
          i++;

          while (i < parts.length && parts[i] && !/^\d+$/.test(parts[i]?.trim() || '')) {
            const file = parts[i]?.trim();
            if (file) {
              // Extract just the filename from the full path
              const filename = file.split('/').pop()!;
              // First occurrence = most recent (git log is newest-first)
              if (!result.has(filename)) {
                result.set(filename, date);
              }
            }
            i++;
          }
        } else {
          i++;
        }
      }
    } catch {
      // Return empty map on failure
    }

    return result;
  }

  /**
   * Execute a git command asynchronously
   * @throws Error if command fails
   */
  private async execGit(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    return stdout;
  }
}
