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
 * Max branches to index concurrently
 */
const BRANCH_BATCH_SIZE = 5;

/**
 * Max task files to hydrate concurrently
 */
const HYDRATE_BATCH_SIZE = 8;

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
 * Lightweight index entry for a task file on a branch (no content read required)
 */
interface TaskFileIndexEntry {
  filename: string;
  taskId: string;
  lastModified: Date;
  branch: string;
}

/**
 * Loads and merges tasks from multiple git branches.
 * Uses an index-first strategy: builds a cheap file index per branch,
 * then only reads full content for tasks that need hydrating.
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
      const branches = await this.getBranchesToScan();
      const currentBranch = await this.gitService.getCurrentBranch();

      console.log(
        `[CrossBranchTaskLoader] Scanning ${branches.length} branches:`,
        branches.map((b) => b.name)
      );

      // Phase 0: Load current branch tasks from disk + get their git timestamps
      const [localTasks, localModifiedMap] = await Promise.all([
        this.parser.getTasks(),
        this.gitService.getFileModifiedMap(currentBranch, 'backlog/tasks'),
      ]);
      const localTaskMap = new Map<string, Task>();
      for (const task of localTasks) {
        task.source = 'local';
        task.branch = currentBranch;
        // Set lastModified from git timestamps for conflict resolution
        const filename = path.basename(task.filePath);
        const modified = localModifiedMap.get(filename);
        if (modified) {
          task.lastModified = modified;
        }
        localTaskMap.set(task.id, task);
      }

      // Filter out current branch from git scanning
      const otherBranches = branches.filter((b) => b.name !== currentBranch);

      if (otherBranches.length === 0) {
        return localTasks;
      }

      // Phase 1: Build cheap index for all other branches (parallel batches)
      const allIndexEntries: TaskFileIndexEntry[] = [];
      for (let i = 0; i < otherBranches.length; i += BRANCH_BATCH_SIZE) {
        const batch = otherBranches.slice(i, i + BRANCH_BATCH_SIZE);
        const results = await Promise.all(
          batch.map((branch) => this.buildBranchIndex(branch.name))
        );
        for (const entries of results) {
          allIndexEntries.push(...entries);
        }
      }

      // Phase 2: Filter — decide which entries need full content
      const strategy = this.config.task_resolution_strategy ?? DEFAULT_RESOLUTION_STRATEGY;
      const entriesToHydrate = allIndexEntries.filter((entry) =>
        this.shouldHydrate(entry, localTaskMap, strategy)
      );

      console.log(
        `[CrossBranchTaskLoader] Index: ${allIndexEntries.length} entries, hydrating ${entriesToHydrate.length}`
      );

      // Phase 3: Hydrate — read full content only for needed entries (parallel batches)
      const hydratedTasks: Task[] = [];
      for (let i = 0; i < entriesToHydrate.length; i += HYDRATE_BATCH_SIZE) {
        const batch = entriesToHydrate.slice(i, i + HYDRATE_BATCH_SIZE);
        const results = await Promise.all(batch.map((entry) => this.hydrateTask(entry)));
        for (const task of results) {
          if (task) {
            hydratedTasks.push(task);
          }
        }
      }

      // Phase 4: Merge — combine local + hydrated, resolve conflicts
      const taskGroups = new Map<string, Task[]>();
      for (const task of localTasks) {
        taskGroups.set(task.id, [task]);
      }
      for (const task of hydratedTasks) {
        const existing = taskGroups.get(task.id) || [];
        existing.push(task);
        taskGroups.set(task.id, existing);
      }

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
  private async getBranchesToScan(): Promise<BranchInfo[]> {
    const currentBranch = await this.gitService.getCurrentBranch();
    const activeDays = this.config.active_branch_days ?? DEFAULT_ACTIVE_BRANCH_DAYS;

    const branches = await this.gitService.listRecentBranches(activeDays);

    // Always include current branch even if older than cutoff
    const hasCurrentBranch = branches.some((b) => b.name === currentBranch);
    if (!hasCurrentBranch) {
      const allBranches = await this.gitService.listLocalBranches();
      const current = allBranches.find((b) => b.name === currentBranch);
      if (current) {
        branches.push(current);
      }
    }

    const mainBranch = await this.gitService.getMainBranch();

    branches.sort((a, b) => {
      if (a.name === currentBranch) return -1;
      if (b.name === currentBranch) return 1;
      if (a.name === mainBranch) return -1;
      if (b.name === mainBranch) return 1;
      return b.lastCommitDate.getTime() - a.lastCommitDate.getTime();
    });

    return branches;
  }

  /**
   * Build a cheap index of task files on a branch (no content reads).
   * Uses batch timestamp collection for efficiency.
   */
  private async buildBranchIndex(branch: string): Promise<TaskFileIndexEntry[]> {
    const tasksRelativePath = 'backlog/tasks';

    const backlogExists = await this.gitService.pathExistsOnBranch(branch, 'backlog');
    if (!backlogExists) {
      return [];
    }

    // Get file list and modification timestamps in parallel
    const [taskFiles, modifiedMap] = await Promise.all([
      this.gitService.listFilesInPath(branch, tasksRelativePath),
      this.gitService.getFileModifiedMap(branch, tasksRelativePath),
    ]);

    const entries: TaskFileIndexEntry[] = [];
    for (const filename of taskFiles) {
      if (!filename.endsWith('.md')) continue;

      // Extract task ID from filename (e.g., "task-1 - Test-task.md" → "TASK-1")
      const idMatch = filename.match(/^([a-zA-Z]+-\d+(?:\.\d+)*)/i);
      if (!idMatch) continue;

      const taskId = idMatch[1].toUpperCase();
      const lastModified = modifiedMap.get(filename) || new Date(0);

      entries.push({ filename, taskId, lastModified, branch });
    }

    return entries;
  }

  /**
   * Decide if an index entry needs full content hydration.
   */
  private shouldHydrate(
    entry: TaskFileIndexEntry,
    localTasks: Map<string, Task>,
    strategy: TaskResolutionStrategy
  ): boolean {
    const localTask = localTasks.get(entry.taskId);

    // Task doesn't exist locally — always hydrate
    if (!localTask) return true;

    // most_progressed needs status from content — always hydrate
    if (strategy === 'most_progressed') return true;

    // most_recent: only hydrate if remote is newer
    const localTime = localTask.lastModified?.getTime() ?? 0;
    return entry.lastModified.getTime() > localTime;
  }

  /**
   * Read full task content from a branch and parse it.
   */
  private async hydrateTask(entry: TaskFileIndexEntry): Promise<Task | null> {
    const filePath = `backlog/tasks/${entry.filename}`;
    const workspaceRoot = path.dirname(this.backlogPath);

    try {
      const content = await this.gitService.readFileFromBranch(entry.branch, filePath);
      if (!content) return null;

      const absolutePath = path.join(workspaceRoot, filePath);
      const task = this.parser.parseTaskContent(content, absolutePath);
      if (!task) return null;

      task.source = 'local-branch' as TaskSource;
      task.branch = entry.branch;
      task.lastModified = entry.lastModified;

      return task;
    } catch (error) {
      console.error(
        `[CrossBranchTaskLoader] Error hydrating ${entry.filename} on ${entry.branch}:`,
        error
      );
      return null;
    }
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
      return tasks.reduce((latest, task) => {
        const latestTime = latest.lastModified?.getTime() ?? 0;
        const taskTime = task.lastModified?.getTime() ?? 0;
        return taskTime > latestTime ? task : latest;
      });
    }

    // strategy === 'most_progressed'
    return tasks.reduce((mostProgressed, task) => {
      const currentProgress = STATUS_ORDER[task.status] ?? 0;
      const bestProgress = STATUS_ORDER[mostProgressed.status] ?? 0;
      return currentProgress > bestProgress ? task : mostProgressed;
    });
  }
}
