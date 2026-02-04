import * as path from 'path';
import { GitBranchService, BranchInfo } from './GitBranchService';
import { BacklogParser } from './BacklogParser';
import { Task, BacklogConfig, TaskResolutionStrategy, TaskSource } from './types';

/**
 * Default number of days to look back for active branches
 */
const DEFAULT_ACTIVE_BRANCH_DAYS = 30;

/**
 * Default resolution strategy for conflicting task states
 */
const DEFAULT_RESOLUTION_STRATEGY: TaskResolutionStrategy = 'most_recent';

/**
 * Status progression order (higher = more progressed)
 */
const STATUS_ORDER: Record<string, number> = {
  Draft: 0,
  'To Do': 1,
  'In Progress': 2,
  Done: 3,
};

/**
 * Loads and merges tasks from multiple git branches.
 * Handles task deduplication and conflict resolution when the same task
 * exists on multiple branches with different states.
 */
export class CrossBranchTaskLoader {
  private gitService: GitBranchService;
  private config: BacklogConfig;
  private backlogPath: string;

  constructor(
    gitService: GitBranchService,
    private parser: BacklogParser,
    config: BacklogConfig,
    backlogPath: string
  ) {
    this.gitService = gitService;
    this.config = config;
    this.backlogPath = backlogPath;
  }

  /**
   * Load tasks from all active branches and merge them.
   * Falls back to local-only on any git errors.
   */
  async loadTasksAcrossBranches(): Promise<Task[]> {
    try {
      // Get branches to scan
      const branches = this.getBranchesToScan();
      console.log(
        `[CrossBranchTaskLoader] Scanning ${branches.length} branches:`,
        branches.map((b) => b.name)
      );

      // Load tasks from all branches
      const taskGroups = new Map<string, Task[]>();

      for (const branch of branches) {
        const tasks = await this.loadTasksFromBranch(branch);
        for (const task of tasks) {
          const existing = taskGroups.get(task.id) || [];
          existing.push(task);
          taskGroups.set(task.id, existing);
        }
      }

      // Merge and resolve conflicts
      const mergedTasks = this.mergeTasksByResolutionStrategy(taskGroups);

      console.log(
        `[CrossBranchTaskLoader] Loaded ${mergedTasks.length} tasks from ${branches.length} branches`
      );
      return mergedTasks;
    } catch (error) {
      console.error('[CrossBranchTaskLoader] Error loading cross-branch tasks:', error);
      throw error;
    }
  }

  /**
   * Get the list of branches to scan based on configuration
   */
  private getBranchesToScan(): BranchInfo[] {
    const currentBranch = this.gitService.getCurrentBranch();
    const activeDays = this.config.active_branch_days ?? DEFAULT_ACTIVE_BRANCH_DAYS;

    // Get recent branches
    const branches = this.gitService.listRecentBranches(activeDays);

    // Always include current branch even if it's older than the cutoff
    const hasCurrentBranch = branches.some((b) => b.name === currentBranch);
    if (!hasCurrentBranch) {
      const allBranches = this.gitService.listLocalBranches();
      const current = allBranches.find((b) => b.name === currentBranch);
      if (current) {
        branches.push(current);
      }
    }

    // Prioritize: current branch first, then main/master, then others by date
    const mainBranch = this.gitService.getMainBranch();

    branches.sort((a, b) => {
      // Current branch always first
      if (a.name === currentBranch) return -1;
      if (b.name === currentBranch) return 1;

      // Main branch second
      if (a.name === mainBranch) return -1;
      if (b.name === mainBranch) return 1;

      // Then by commit date (most recent first)
      return b.lastCommitDate.getTime() - a.lastCommitDate.getTime();
    });

    return branches;
  }

  /**
   * Load all tasks from a specific branch
   */
  private async loadTasksFromBranch(branch: BranchInfo): Promise<Task[]> {
    const tasks: Task[] = [];
    const currentBranch = this.gitService.getCurrentBranch();
    const isCurrentBranch = branch.name === currentBranch;

    // Calculate relative path from workspace root to tasks directory
    // backlogPath is absolute, we need just "backlog/tasks"
    const workspaceRoot = path.dirname(this.backlogPath);
    const tasksRelativePath = 'backlog/tasks';

    // Check if tasks directory exists on this branch
    const backlogExists = this.gitService.pathExistsOnBranch(branch.name, 'backlog');
    if (!backlogExists) {
      console.log(`[CrossBranchTaskLoader] No backlog folder on branch ${branch.name}`);
      return [];
    }

    // List task files on this branch
    const taskFiles = this.gitService.listFilesInPath(branch.name, tasksRelativePath);
    const mdFiles = taskFiles.filter((f) => f.endsWith('.md'));

    console.log(
      `[CrossBranchTaskLoader] Found ${mdFiles.length} task files on branch ${branch.name}`
    );

    for (const filename of mdFiles) {
      try {
        const filePath = `${tasksRelativePath}/${filename}`;
        const content = this.gitService.readFileFromBranch(branch.name, filePath);

        if (!content) continue;

        // Parse the task content
        const absolutePath = path.join(workspaceRoot, filePath);
        const task = this.parser.parseTaskContent(content, absolutePath);

        if (task) {
          // Add cross-branch metadata
          task.source = this.determineTaskSource(branch.name, isCurrentBranch);
          task.branch = branch.name;

          // Get last modified time for the task file
          const lastModified = this.gitService.getFileLastModified(branch.name, filePath);
          if (lastModified) {
            task.lastModified = lastModified;
          }

          tasks.push(task);
        }
      } catch (error) {
        console.error(
          `[CrossBranchTaskLoader] Error parsing task ${filename} on ${branch.name}:`,
          error
        );
      }
    }

    return tasks;
  }

  /**
   * Determine the source type for a task based on its branch
   */
  private determineTaskSource(branchName: string, isCurrentBranch: boolean): TaskSource {
    if (isCurrentBranch) {
      return 'local';
    }
    return 'local-branch';
  }

  /**
   * Merge tasks from multiple branches, resolving conflicts by the configured strategy
   */
  private mergeTasksByResolutionStrategy(taskGroups: Map<string, Task[]>): Task[] {
    const strategy = this.config.task_resolution_strategy ?? DEFAULT_RESOLUTION_STRATEGY;
    const mergedTasks: Task[] = [];

    for (const [_taskId, tasks] of taskGroups) {
      if (tasks.length === 1) {
        mergedTasks.push(tasks[0]);
      } else {
        const resolved = this.resolveTaskConflict(tasks, strategy);
        mergedTasks.push(resolved);
      }
    }

    return mergedTasks;
  }

  /**
   * Resolve a conflict when the same task exists on multiple branches
   */
  private resolveTaskConflict(tasks: Task[], strategy: TaskResolutionStrategy): Task {
    if (tasks.length === 0) {
      throw new Error('No tasks to resolve');
    }

    if (tasks.length === 1) {
      return tasks[0];
    }

    if (strategy === 'most_recent') {
      // Pick the task with the most recent lastModified date
      return tasks.reduce((latest, task) => {
        const latestTime = latest.lastModified?.getTime() ?? 0;
        const taskTime = task.lastModified?.getTime() ?? 0;
        return taskTime > latestTime ? task : latest;
      });
    }

    // strategy === 'most_progressed'
    // Pick the task with the highest status progression
    return tasks.reduce((mostProgressed, task) => {
      const currentProgress = STATUS_ORDER[task.status] ?? 0;
      const bestProgress = STATUS_ORDER[mostProgressed.status] ?? 0;
      return currentProgress > bestProgress ? task : mostProgressed;
    });
  }
}
