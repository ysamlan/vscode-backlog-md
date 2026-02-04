import { execSync } from 'child_process';

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
 * Uses raw git commands via execSync for direct git CLI access.
 */
export class GitBranchService {
  constructor(private workspaceRoot: string) {}

  /**
   * Check if the workspace is a git repository
   */
  isGitRepository(): boolean {
    try {
      this.execGit('rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   */
  getCurrentBranch(): string {
    const output = this.execGit('rev-parse --abbrev-ref HEAD');
    return output.trim();
  }

  /**
   * Get the main/default branch name (main or master)
   */
  getMainBranch(): string {
    // Try to detect the main branch
    const branches = this.listLocalBranches();
    const branchNames = branches.map((b) => b.name);

    if (branchNames.includes('main')) return 'main';
    if (branchNames.includes('master')) return 'master';

    // Fallback: return first branch or 'main'
    return branchNames[0] || 'main';
  }

  /**
   * List all local branches with their last commit dates
   */
  listLocalBranches(): BranchInfo[] {
    try {
      const output = this.execGit(
        'for-each-ref --format="%(refname:short) %(committerdate:unix)" refs/heads/'
      );

      if (!output.trim()) {
        return [];
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          // Parse "branch-name timestamp" format
          const parts = line.trim().split(' ');
          const timestamp = parseInt(parts[parts.length - 1], 10);
          const name = parts.slice(0, -1).join(' '); // Handle branch names with spaces

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
  listRecentBranches(daysAgo: number): BranchInfo[] {
    const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const branches = this.listLocalBranches();

    return branches.filter((branch) => branch.lastCommitDate.getTime() > cutoffDate.getTime());
  }

  /**
   * Read a file from a specific branch without checking it out
   * @returns File content or null if file doesn't exist on that branch
   */
  readFileFromBranch(branch: string, filePath: string): string | null {
    try {
      // Normalize path separators for git (always use forward slashes)
      const normalizedPath = filePath.replace(/\\/g, '/');
      const output = this.execGit(`show "${branch}:${normalizedPath}"`);
      return output;
    } catch {
      // File doesn't exist on this branch
      return null;
    }
  }

  /**
   * List files in a directory on a specific branch
   * @returns Array of file names (not full paths)
   */
  listFilesInPath(branch: string, dirPath: string): string[] {
    try {
      // Normalize path separators and ensure trailing slash
      let normalizedPath = dirPath.replace(/\\/g, '/');
      if (!normalizedPath.endsWith('/')) {
        normalizedPath += '/';
      }

      const output = this.execGit(`ls-tree --name-only "${branch}" "${normalizedPath}"`);

      if (!output.trim()) {
        return [];
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          // ls-tree returns full paths, extract just the filename
          const parts = line.split('/');
          return parts[parts.length - 1];
        });
    } catch {
      // Directory doesn't exist on this branch
      return [];
    }
  }

  /**
   * Check if a path exists on a specific branch
   */
  pathExistsOnBranch(branch: string, filePath: string): boolean {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      this.execGit(`cat-file -e "${branch}:${normalizedPath}"`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the last commit date for a specific branch
   */
  getBranchLastCommitDate(branch: string): Date {
    const timestamp = this.execGit(`log -1 --format=%ct "${branch}"`).trim();
    return new Date(parseInt(timestamp, 10) * 1000);
  }

  /**
   * Get a map of branch names to their last commit dates
   */
  getBranchLastModifiedMap(): Map<string, Date> {
    const branches = this.listLocalBranches();
    const map = new Map<string, Date>();

    for (const branch of branches) {
      map.set(branch.name, branch.lastCommitDate);
    }

    return map;
  }

  /**
   * Get the last modified time of a file on a specific branch
   * Uses the commit date of the last commit that touched the file
   */
  getFileLastModified(branch: string, filePath: string): Date | null {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const timestamp = this.execGit(
        `log -1 --format=%ct "${branch}" -- "${normalizedPath}"`
      ).trim();

      if (!timestamp) {
        return null;
      }

      return new Date(parseInt(timestamp, 10) * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Execute a git command in the workspace root
   * @throws Error if command fails
   */
  private execGit(command: string): string {
    return execSync(`git ${command}`, {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      // Set a reasonable timeout (10 seconds for most operations)
      timeout: 10000,
    });
  }
}
