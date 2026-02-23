import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskFolder,
  ChecklistItem,
  Milestone,
  BacklogConfig,
  BacklogDocument,
  BacklogDecision,
  DocumentType,
  DecisionStatus,
} from './types';
import { GitBranchService } from './GitBranchService';
import { CrossBranchTaskLoader } from './CrossBranchTaskLoader';

/**
 * Raw frontmatter structure from YAML parsing
 */
interface RawFrontmatter {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  milestone?: string;
  labels?: string[] | string;
  assignee?: string[] | string;
  assignees?: string[] | string;
  dependencies?: string[] | string;
  references?: string[] | string;
  documentation?: string[] | string;
  type?: string;
  parent?: string;
  parent_task_id?: string;
  subtasks?: string[] | string;
  created_date?: string;
  created?: string;
  updated_date?: string;
  updated?: string;
  ordinal?: number;
  reporter?: string;
}

interface RawMilestoneFrontmatter {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
}

/**
 * Pre-process YAML frontmatter to quote unquoted @-prefixed values
 * in assignee/reporter fields. YAML treats @ as a reserved character,
 * so bare values like `reporter: @alice` cause parse errors.
 * Matches upstream Backlog.md behavior (src/markdown/parser.ts).
 */
function preprocessFrontmatter(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(\s*(?:assignee|reporter):\s*)(.*)$/);
      if (!match) return line;

      const prefix = match[1];
      const value = (match[2] ?? '').trim();

      // Inline array — quote any bare @-prefixed entries
      if (value.startsWith('[')) {
        const listMatch = value.match(/^\[(.*)\]\s*(#.*)?$/);
        if (!listMatch) return line;
        const items = (listMatch[1] ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e.length > 0);
        const normalized = items.map((entry) => {
          if (entry.startsWith("'") || entry.startsWith('"')) return entry;
          if (entry.startsWith('@'))
            return `"${entry.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
          return entry;
        });
        const comment = listMatch[2] ? ` ${listMatch[2]}` : '';
        return `${prefix}[${normalized.join(', ')}]${comment}`;
      }

      // Bare scalar — quote if not already quoted and not a block indicator
      if (value && !value.startsWith("'") && !value.startsWith('"') && !value.startsWith('-')) {
        return `${prefix}"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      }
      return line;
    })
    .join('\n');
}

/**
 * Compute subtask relationships from parentTaskId fields.
 * Populates the `subtasks` array on parent tasks by scanning all tasks
 * for those with a matching `parentTaskId`.
 * This overwrites any existing `subtasks` arrays.
 */
export function computeSubtasks(tasks: Task[]): void {
  const parentToChildren = new Map<string, string[]>();

  for (const task of tasks) {
    if (task.parentTaskId) {
      const children = parentToChildren.get(task.parentTaskId);
      if (children) {
        children.push(task.id);
      } else {
        parentToChildren.set(task.parentTaskId, [task.id]);
      }
    }
  }

  for (const task of tasks) {
    const children = parentToChildren.get(task.id);
    if (children) {
      task.subtasks = children.sort();
    }
  }
}

/**
 * Parses Backlog.md task files from the filesystem
 */
export class BacklogParser {
  private cachedConfig: BacklogConfig | undefined;
  private cachedConfigMtime: number | undefined;
  private taskCache = new Map<string, { mtimeMs: number; task: Task }>();
  private cachedMilestones: Milestone[] | null = null;
  private milestonesDirMtime: number | undefined;

  constructor(private backlogPath: string) {}

  /**
   * Invalidate the config cache, forcing the next getConfig() call to re-read from disk.
   */
  invalidateConfigCache(): void {
    this.cachedConfig = undefined;
    this.cachedConfigMtime = undefined;
  }

  /**
   * Invalidate the task cache, forcing subsequent reads to re-parse from disk.
   * @param filePath - If provided, only invalidate the cache for that specific file.
   *                   Otherwise, clear the entire task cache.
   */
  invalidateTaskCache(filePath?: string): void {
    if (filePath) {
      this.taskCache.delete(filePath);
    } else {
      this.taskCache.clear();
      this.invalidateMilestoneCache();
    }
  }

  /**
   * Invalidate the milestone cache, forcing the next getMilestonesFromFiles() call to re-read from disk.
   */
  invalidateMilestoneCache(): void {
    this.cachedMilestones = null;
    this.milestonesDirMtime = undefined;
  }

  /**
   * Get all tasks from the backlog folder
   */
  async getTasks(): Promise<Task[]> {
    return this.getTasksFromFolder('tasks');
  }

  /**
   * Get tasks from a specific subfolder within the backlog directory
   */
  async getTasksFromFolder(folderName: string): Promise<Task[]> {
    const folderPath = path.join(this.backlogPath, folderName);
    console.log(`[Backlog.md Parser] Looking for tasks in: ${folderPath}`);

    if (!fs.existsSync(folderPath)) {
      console.log(`[Backlog.md Parser] Path does not exist: ${folderPath}`);
      return [];
    }

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.md'));
    console.log(`[Backlog.md Parser] Found ${files.length} .md files:`, files.slice(0, 5));
    const tasks: Task[] = [];
    const currentPaths = new Set<string>();
    const milestones = this.getMilestonesFromFiles();

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      currentPaths.add(filePath);
      try {
        const stat = fs.statSync(filePath);
        const cached = this.taskCache.get(filePath);
        let task: Task | undefined;

        if (cached && cached.mtimeMs === stat.mtimeMs) {
          task = cached.task;
        } else {
          task = await this.parseTaskFile(filePath);
          if (task) {
            this.taskCache.set(filePath, { mtimeMs: stat.mtimeMs, task });
          }
        }

        if (task) {
          task.milestone = this.resolveMilestoneValue(task.milestone, milestones);
          task.folder = (folderName === 'archive/tasks' ? 'archive' : folderName) as TaskFolder;
          tasks.push(task);
        }
      } catch (error) {
        console.error(`[Backlog.md Parser] Error parsing task file ${file}:`, error);
      }
    }

    // Evict cache entries for files that no longer exist in this folder
    const folderPrefix = folderPath + path.sep;
    for (const cachedPath of this.taskCache.keys()) {
      if (cachedPath.startsWith(folderPrefix) && !currentPaths.has(cachedPath)) {
        this.taskCache.delete(cachedPath);
      }
    }

    // Deduplicate by task ID (keep last occurrence — matches upstream ContentStore behavior)
    const seenIds = new Map<string, number>();
    for (let i = 0; i < tasks.length; i++) {
      const prevIdx = seenIds.get(tasks[i].id);
      if (prevIdx !== undefined) {
        console.warn(
          `[Backlog.md Parser] Duplicate task ID "${tasks[i].id}" in ${folderName}/, keeping latest file`
        );
      }
      seenIds.set(tasks[i].id, i);
    }
    const dedupedTasks =
      seenIds.size === tasks.length ? tasks : [...seenIds.values()].map((idx) => tasks[idx]);

    console.log(
      `[Backlog.md Parser] Successfully parsed ${dedupedTasks.length} tasks from ${folderName}`
    );
    return dedupedTasks;
  }

  /**
   * Get draft tasks from the drafts/ folder.
   * Enforces status: 'Draft' on all returned tasks.
   */
  async getDrafts(): Promise<Task[]> {
    const tasks = await this.getTasksFromFolder('drafts');
    return tasks.map((t) => ({ ...t, status: 'Draft' }));
  }

  /**
   * Get completed tasks from the completed/ folder.
   * Sets source: 'completed' on all returned tasks.
   */
  async getCompletedTasks(): Promise<Task[]> {
    const tasks = await this.getTasksFromFolder('completed');
    return tasks.map((t) => ({ ...t, source: 'completed' as const }));
  }

  /**
   * Get archived tasks from the archive/tasks/ folder.
   * Sets folder: 'archive' on all returned tasks.
   */
  async getArchivedTasks(): Promise<Task[]> {
    return this.getTasksFromFolder('archive/tasks');
  }

  /**
   * Get a single task by ID, searching tasks/, then drafts/, then completed/, then archive/tasks/
   */
  async getTask(taskId: string): Promise<Task | undefined> {
    for (const folder of ['tasks', 'drafts', 'completed', 'archive/tasks']) {
      const tasks = await this.getTasksFromFolder(folder);
      const found = tasks.find((t) => t.id === taskId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Convert a camelCase string to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Normalize config object keys from camelCase to snake_case.
   * Backlog.md supports both formats in config files.
   */
  private normalizeConfigKeys(raw: Record<string, unknown>): BacklogConfig {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      const snakeKey = this.camelToSnake(key);
      // Only use the snake_case version if not already set
      if (!(snakeKey in normalized)) {
        normalized[snakeKey] = value;
      }
      // Also keep the original key if it's already snake_case
      if (key === snakeKey && !(key in normalized)) {
        normalized[key] = value;
      }
    }
    // Normalize zero_padded_ids: boolean→number for backward compat
    if ('zero_padded_ids' in normalized) {
      const val = normalized.zero_padded_ids;
      if (val === true) {
        normalized.zero_padded_ids = 3;
      } else if (val === false || val === 0) {
        delete normalized.zero_padded_ids;
      }
    }

    return normalized as BacklogConfig;
  }

  /**
   * Get the backlog configuration from config.yml
   */
  async getConfig(): Promise<BacklogConfig> {
    // Try both .yml and .yaml extensions
    const ymlPath = path.join(this.backlogPath, 'config.yml');
    const yamlPath = path.join(this.backlogPath, 'config.yaml');
    const configPath = fs.existsSync(ymlPath) ? ymlPath : yamlPath;

    if (!fs.existsSync(configPath)) {
      console.log(`[Backlog.md Parser] No config file found at ${ymlPath} or ${yamlPath}`);
      return {};
    }

    try {
      // Check mtime for cache invalidation
      const mtime = fs.statSync(configPath).mtimeMs;
      if (this.cachedConfig && this.cachedConfigMtime === mtime) {
        return this.cachedConfig;
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      const raw = yaml.load(content) as Record<string, unknown> | null;
      if (!raw) return {};
      const config = this.normalizeConfigKeys(raw);
      this.cachedConfig = config;
      this.cachedConfigMtime = mtime;
      return config;
    } catch (error) {
      console.error(`[Backlog.md Parser] Error parsing config file:`, error);
      return {};
    }
  }

  /**
   * Get all milestones, using milestone files as source-of-truth with config fallback.
   */
  async getMilestones(): Promise<Milestone[]> {
    const fileMilestones = this.getMilestonesFromFiles();
    if (fileMilestones.length > 0) {
      return fileMilestones;
    }

    const config = await this.getConfig();
    return this.normalizeConfigMilestones(config.milestones);
  }

  /**
   * Get configured statuses (for Kanban columns)
   */
  async getStatuses(): Promise<string[]> {
    const config = await this.getConfig();
    return config.statuses || ['To Do', 'In Progress', 'Done'];
  }

  /**
   * Get all unique labels from config and all tasks (for autocomplete)
   */
  async getUniqueLabels(): Promise<string[]> {
    const tasks = await this.getTasks();
    const config = await this.getConfig();
    const labelSet = new Set<string>(config.labels || []);
    tasks.forEach((task) => task.labels.forEach((l) => labelSet.add(l)));
    return Array.from(labelSet).sort();
  }

  /**
   * Get all unique assignees from all tasks (for autocomplete)
   */
  async getUniqueAssignees(): Promise<string[]> {
    const tasks = await this.getTasks();
    const assigneeSet = new Set<string>();
    tasks.forEach((task) => task.assignee.forEach((a) => assigneeSet.add(a)));
    return Array.from(assigneeSet).sort();
  }

  /**
   * Get task IDs that are blocked by (depend on) the given task.
   * Returns IDs of tasks whose dependencies array contains the given taskId.
   */
  async getBlockedByThisTask(taskId: string): Promise<string[]> {
    const tasks = await this.getTasks();
    return tasks.filter((task) => task.dependencies.includes(taskId)).map((task) => task.id);
  }

  /**
   * Get tasks with cross-branch support.
   * If cross-branch is enabled in config and the workspace is a git repo,
   * loads and merges tasks from all active branches.
   * Falls back to local-only on any errors.
   */
  async getTasksWithCrossBranch(): Promise<Task[]> {
    const config = await this.getConfig();

    // Check if cross-branch features are enabled
    if (!config.check_active_branches) {
      // Local-only mode (default)
      return this.getTasks();
    }

    // Get workspace root (parent of backlog folder)
    const workspaceRoot = path.dirname(this.backlogPath);

    // Check if this is a git repository
    const gitService = new GitBranchService(workspaceRoot);
    if (!(await gitService.isGitRepository())) {
      console.log('[Backlog.md Parser] Not a git repository, falling back to local-only');
      return this.getTasks();
    }

    try {
      const loader = new CrossBranchTaskLoader(gitService, this, config, this.backlogPath);
      return await loader.loadTasksAcrossBranches();
    } catch (error) {
      // Fallback to local-only on git errors
      console.error(
        '[Backlog.md Parser] Cross-branch loading failed, falling back to local:',
        error
      );
      return this.getTasks();
    }
  }

  /**
   * Parse a single task file
   */
  async parseTaskFile(filePath: string): Promise<Task | undefined> {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseTaskContent(content, filePath);
  }

  /**
   * Parse task content from markdown with YAML frontmatter
   */
  parseTaskContent(content: string, filePath: string): Task | undefined {
    const lines = content.split('\n');

    // Extract ID from filename
    const filename = path.basename(filePath, '.md');
    const idMatch = filename.match(/^([a-zA-Z]+-\d+(?:\.\d+)*)/i);
    const id = idMatch ? idMatch[1].toUpperCase() : filename;

    // Initialize task with defaults
    const task: Task = {
      id,
      title: '',
      status: 'To Do',
      labels: [],
      assignee: [],
      dependencies: [],
      acceptanceCriteria: [],
      definitionOfDone: [],
      filePath,
    };

    // Parse YAML frontmatter if present
    let lineIndex = 0;
    if (lines[0]?.trim() === '---') {
      lineIndex = 1;
      const frontmatterLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex]?.trim() !== '---') {
        frontmatterLines.push(lines[lineIndex]);
        lineIndex++;
      }
      lineIndex++; // Skip closing ---

      // Parse frontmatter using js-yaml
      try {
        const frontmatterYaml = preprocessFrontmatter(frontmatterLines.join('\n'));
        const frontmatter = yaml.load(frontmatterYaml) as RawFrontmatter | null;
        if (frontmatter) {
          this.applyFrontmatter(frontmatter, task);
        }
      } catch (error) {
        console.error(`[Backlog.md Parser] Error parsing YAML frontmatter in ${filePath}:`, error);
      }
    }

    // Parse rest of content for sections
    let currentSection = '';
    const descriptionLines: string[] = [];
    const notesLines: string[] = [];
    const summaryLines: string[] = [];
    const planLines: string[] = [];
    let inDescriptionBlock = false;
    let inStructuredBlock = false;

    for (let i = lineIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Track structured section markers (PLAN, NOTES, FINAL_SUMMARY)
      if (/^<!-- SECTION:(?:PLAN|NOTES|FINAL_SUMMARY):BEGIN -->$/.test(trimmedLine)) {
        inStructuredBlock = true;
        continue;
      }
      if (/^<!-- SECTION:(?:PLAN|NOTES|FINAL_SUMMARY):END -->$/.test(trimmedLine)) {
        inStructuredBlock = false;
        continue;
      }

      // Track description section markers
      if (trimmedLine === '<!-- SECTION:DESCRIPTION:BEGIN -->') {
        inDescriptionBlock = true;
        continue;
      }
      if (trimmedLine === '<!-- SECTION:DESCRIPTION:END -->') {
        inDescriptionBlock = false;
        continue;
      }

      // Parse title from first heading (fallback if not in frontmatter)
      if (trimmedLine.startsWith('# ') && !task.title) {
        const titleMatch = trimmedLine.match(/^#\s+(?:TASK-\d+\s*-\s*)?(.+)$/i);
        if (titleMatch) {
          task.title = titleMatch[1].trim();
        }
        continue;
      }

      // Parse sections — skip header detection when inside structured block markers
      if (trimmedLine.startsWith('## ') && !inStructuredBlock) {
        const sectionName = trimmedLine.substring(3).toLowerCase();

        if (sectionName.includes('description')) {
          currentSection = 'description';
        } else if (sectionName.includes('acceptance criteria')) {
          currentSection = 'acceptance';
        } else if (sectionName.includes('definition of done')) {
          currentSection = 'dod';
        } else if (sectionName.includes('implementation notes') || sectionName === 'notes') {
          currentSection = 'notes';
        } else if (sectionName.includes('plan')) {
          // "## Plan" or "## Implementation Plan" but NOT "## Implementation Notes"
          currentSection = 'plan';
        } else if (sectionName.includes('final summary') || sectionName.includes('summary')) {
          currentSection = 'summary';
        } else {
          currentSection = '';
        }
        continue;
      }

      // Handle section content
      if (currentSection === 'description') {
        if (inDescriptionBlock && (trimmedLine || descriptionLines.length > 0)) {
          descriptionLines.push(line);
        } else if (
          !inDescriptionBlock &&
          (trimmedLine || descriptionLines.length > 0) &&
          !trimmedLine.startsWith('<!--')
        ) {
          descriptionLines.push(line);
        }
      } else if (currentSection === 'acceptance') {
        const checkItem = this.parseChecklistItem(trimmedLine, task.acceptanceCriteria.length + 1);
        if (checkItem) {
          task.acceptanceCriteria.push(checkItem);
        }
      } else if (currentSection === 'dod') {
        const checkItem = this.parseChecklistItem(trimmedLine, task.definitionOfDone.length + 1);
        if (checkItem) {
          task.definitionOfDone.push(checkItem);
        }
      } else if (
        currentSection === 'notes' &&
        (trimmedLine || notesLines.length > 0) &&
        !trimmedLine.startsWith('<!--')
      ) {
        notesLines.push(line);
      } else if (
        currentSection === 'summary' &&
        (trimmedLine || summaryLines.length > 0) &&
        !trimmedLine.startsWith('<!--')
      ) {
        summaryLines.push(line);
      } else if (
        currentSection === 'plan' &&
        (trimmedLine || planLines.length > 0) &&
        !trimmedLine.startsWith('<!--')
      ) {
        planLines.push(line);
      }
    }

    task.description = descriptionLines.join('\n').trim() || undefined;
    task.implementationNotes = notesLines.join('\n').trim() || undefined;
    task.finalSummary = summaryLines.join('\n').trim() || undefined;
    task.implementationPlan = planLines.join('\n').trim() || undefined;

    return task.title ? task : undefined;
  }

  /**
   * Apply parsed YAML frontmatter to task object
   */
  private applyFrontmatter(fm: RawFrontmatter, task: Task): void {
    if (fm.id) {
      task.id = String(fm.id).toUpperCase();
    }
    if (fm.title) {
      task.title = String(fm.title);
    }
    if (fm.status) {
      task.status = this.parseStatus(String(fm.status));
    }
    if (fm.priority) {
      task.priority = this.parsePriority(String(fm.priority));
    }
    if (fm.milestone) {
      task.milestone = String(fm.milestone);
    }
    if (fm.labels) {
      task.labels = this.normalizeStringArray(fm.labels);
    }
    if (fm.assignee || fm.assignees) {
      task.assignee = this.normalizeStringArray(fm.assignee || fm.assignees);
    }
    if (fm.dependencies) {
      task.dependencies = this.normalizeStringArray(fm.dependencies);
    }
    if (fm.created_date || fm.created) {
      task.createdAt = this.normalizeDateValue(fm.created_date || fm.created);
    }
    if (fm.updated_date || fm.updated) {
      task.updatedAt = this.normalizeDateValue(fm.updated_date || fm.updated);
    }
    if (fm.parent_task_id || fm.parent) {
      task.parentTaskId = String(fm.parent_task_id || fm.parent);
    }
    if (fm.subtasks) {
      task.subtasks = this.normalizeStringArray(fm.subtasks);
    }
    if (fm.references) {
      task.references = this.normalizeStringArray(fm.references);
    }
    if (fm.documentation) {
      task.documentation = this.normalizeStringArray(fm.documentation);
    }
    if (fm.type) {
      task.type = String(fm.type);
    }
    if (fm.reporter) {
      task.reporter = String(fm.reporter);
    }
    if (typeof fm.ordinal === 'number') {
      task.ordinal = fm.ordinal;
    }
  }

  /**
   * Normalize a value that could be a string or string array into a string array
   */
  private normalizeStringArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter(Boolean);
    }
    return [String(value).trim()].filter(Boolean);
  }

  private getMilestonesFromFiles(): Milestone[] {
    const milestonesPath = path.join(this.backlogPath, 'milestones');
    if (!fs.existsSync(milestonesPath)) return [];

    try {
      const dirMtime = fs.statSync(milestonesPath).mtimeMs;
      if (this.cachedMilestones && this.milestonesDirMtime === dirMtime) {
        return this.cachedMilestones;
      }

      const files = fs
        .readdirSync(milestonesPath)
        .filter((f) => f.endsWith('.md') && /^m-\d+/i.test(f) && f.toLowerCase() !== 'readme.md');

      const milestones: Milestone[] = [];
      for (const file of files) {
        const parsed = this.parseMilestoneFile(path.join(milestonesPath, file));
        if (parsed) milestones.push(parsed);
      }

      const sorted = milestones.sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true })
      );
      this.cachedMilestones = sorted;
      this.milestonesDirMtime = dirMtime;
      return sorted;
    } catch {
      return [];
    }
  }

  private parseMilestoneFile(filePath: string): Milestone | undefined {
    if (!fs.existsSync(filePath)) return undefined;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const filename = path.basename(filePath, '.md');
    const fileIdMatch = filename.match(/^(m-\d+)/i);
    const fallbackId = fileIdMatch?.[1]?.toLowerCase();

    let lineIndex = 0;
    let rawFrontmatter: RawMilestoneFrontmatter | null = null;
    if (lines[0]?.trim() === '---') {
      lineIndex = 1;
      const frontmatterLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex]?.trim() !== '---') {
        frontmatterLines.push(lines[lineIndex]);
        lineIndex++;
      }
      lineIndex++;
      try {
        rawFrontmatter =
          (yaml.load(frontmatterLines.join('\n')) as RawMilestoneFrontmatter) || null;
      } catch {
        rawFrontmatter = null;
      }
    }

    const id = String(rawFrontmatter?.id || fallbackId || '')
      .trim()
      .toLowerCase();
    const frontmatterTitle = rawFrontmatter?.title || rawFrontmatter?.name;
    let name = String(frontmatterTitle || '').trim();
    let description = String(rawFrontmatter?.description || '').trim();

    const bodyLines = lines.slice(lineIndex);
    if (!name) {
      const heading = bodyLines.find((line) => line.trim().startsWith('# '));
      if (heading) {
        name = heading
          .trim()
          .replace(/^#\s+/, '')
          .replace(/^m-\d+\s*-\s*/i, '')
          .trim();
      }
    }
    if (!description) {
      const descriptionLines: string[] = [];
      let inDescription = false;
      for (const line of bodyLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('## ')) {
          inDescription = trimmed.toLowerCase().includes('description');
          continue;
        }
        if (inDescription && trimmed && !trimmed.startsWith('<!--')) {
          descriptionLines.push(line);
        }
      }
      description = descriptionLines.join('\n').trim();
    }

    if (!id || !name) return undefined;
    return {
      id,
      name,
      description: description || undefined,
    };
  }

  private normalizeConfigMilestones(rawMilestones: unknown): Milestone[] {
    if (!Array.isArray(rawMilestones)) return [];
    return rawMilestones
      .map((milestone): Milestone | undefined => {
        if (typeof milestone === 'string') {
          const value = milestone.trim();
          if (!value) return undefined;
          return { id: value, name: value };
        }
        if (typeof milestone === 'object' && milestone !== null) {
          const record = milestone as Record<string, unknown>;
          const id = String(record.id || record.name || '').trim();
          const name = String(record.name || record.title || record.id || '').trim();
          const description =
            typeof record.description === 'string' ? record.description : undefined;
          if (!id || !name) return undefined;
          return { id, name, description };
        }
        return undefined;
      })
      .filter((milestone): milestone is Milestone => Boolean(milestone));
  }

  /**
   * Resolve a raw milestone input (ID, title, or partial match) to a canonical milestone ID.
   * Convenience async wrapper around resolveMilestoneValue that fetches milestones internally.
   */
  async resolveMilestone(raw: string | null | undefined): Promise<string | undefined> {
    const normalized = String(raw || '').trim();
    if (!normalized) return undefined;
    const milestones = await this.getMilestones();
    return this.resolveMilestoneValue(normalized, milestones);
  }

  resolveMilestoneValue(
    rawMilestone: string | undefined,
    milestones: Milestone[]
  ): string | undefined {
    const normalized = String(rawMilestone || '').trim();
    if (!normalized) return undefined;
    const inputKey = normalized.toLowerCase();
    const idMatch = milestones.find((milestone) => milestone.id.trim().toLowerCase() === inputKey);
    if (idMatch) return idMatch.id;

    const titleMatches = milestones.filter(
      (milestone) => milestone.name.trim().toLowerCase() === inputKey
    );
    if (titleMatches.length === 1) {
      return titleMatches[0].id;
    }
    return normalized;
  }

  /**
   * Normalize a date value that may be a Date object (from yaml.load)
   * or a string. Preserves HH:mm time when present. Handles legacy formats
   * (DD-MM-YY, DD/MM/YY, DD.MM.YY) for upstream compatibility.
   */
  private normalizeDateValue(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
      const hours = value.getUTCHours();
      const minutes = value.getUTCMinutes();
      const seconds = value.getUTCSeconds();
      if (hours === 0 && minutes === 0 && seconds === 0) {
        return value.toISOString().slice(0, 10);
      }
      return value.toISOString().slice(0, 16).replace('T', ' ');
    }
    const str = String(value)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!str) return '';

    // YYYY-MM-DD HH:mm (already correct)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) return str;

    // YYYY-MM-DDTHH:mm → convert T to space
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return str.replace('T', ' ');

    // YYYY-MM-DD (standard)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // Legacy: DD-MM-YY
    let match = str.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (match) return `20${match[3]}-${match[2]}-${match[1]}`;

    // Legacy: DD/MM/YY
    match = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (match) return `20${match[3]}-${match[2]}-${match[1]}`;

    // Legacy: DD.MM.YY
    match = str.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
    if (match) return `20${match[3]}-${match[2]}-${match[1]}`;

    return str;
  }

  private parseStatus(value: string): TaskStatus {
    const cleanValue = value.replace(/^[○◒●◑]\s*/, '');
    const lower = cleanValue.toLowerCase();

    // Normalize known statuses
    if (lower.includes('done') || lower.includes('complete')) return 'Done';
    if (lower.includes('progress')) return 'In Progress';
    if (lower.includes('draft')) return 'Draft';
    if (lower === 'to do' || lower === 'todo') return 'To Do';

    // Preserve custom statuses as-is
    return cleanValue;
  }

  private parsePriority(value: string): TaskPriority | undefined {
    const lower = value.toLowerCase();
    if (lower.includes('high')) return 'high';
    if (lower.includes('medium')) return 'medium';
    if (lower.includes('low')) return 'low';
    return undefined;
  }

  private parseChecklistItem(line: string, fallbackIndex: number): ChecklistItem | undefined {
    // Match patterns like "- [ ] #1 Item text" or "- [x] Item text"
    const match = line.match(/^-\s*\[([ xX])\]\s*(?:#(\d+)\s+)?(.+)$/);
    if (!match) return undefined;

    return {
      id: match[2] ? parseInt(match[2], 10) : fallbackIndex,
      checked: match[1].toLowerCase() === 'x',
      text: match[3].trim(),
    };
  }

  /**
   * Get all documents from backlog/docs/ (supports subdirectories)
   */
  async getDocuments(): Promise<BacklogDocument[]> {
    const docsPath = path.join(this.backlogPath, 'docs');
    if (!fs.existsSync(docsPath)) return [];

    const files = this.getMarkdownFilesRecursive(docsPath);
    const documents: BacklogDocument[] = [];

    for (const filePath of files) {
      try {
        const doc = this.parseDocumentFile(filePath);
        if (doc) documents.push(doc);
      } catch (error) {
        console.error(`[Backlog.md Parser] Error parsing document file ${filePath}:`, error);
      }
    }

    return documents.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Get a single document by ID
   */
  async getDocument(docId: string): Promise<BacklogDocument | undefined> {
    const docs = await this.getDocuments();
    return docs.find((d) => d.id === docId);
  }

  /**
   * Get all decisions from backlog/decisions/
   */
  async getDecisions(): Promise<BacklogDecision[]> {
    const decisionsPath = path.join(this.backlogPath, 'decisions');
    if (!fs.existsSync(decisionsPath)) return [];

    const files = fs.readdirSync(decisionsPath).filter((f) => f.endsWith('.md'));
    const decisions: BacklogDecision[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(decisionsPath, file);
        const decision = this.parseDecisionFile(filePath);
        if (decision) decisions.push(decision);
      } catch (error) {
        console.error(`[Backlog.md Parser] Error parsing decision file ${file}:`, error);
      }
    }

    return decisions.sort((a, b) => {
      const aNum = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });
  }

  /**
   * Get a single decision by ID
   */
  async getDecision(decisionId: string): Promise<BacklogDecision | undefined> {
    const decisions = await this.getDecisions();
    return decisions.find((d) => d.id === decisionId);
  }

  /**
   * Recursively get all .md files from a directory
   */
  private getMarkdownFilesRecursive(dirPath: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dirPath)) return results;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.getMarkdownFilesRecursive(fullPath));
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Parse a document file from backlog/docs/
   */
  parseDocumentFile(filePath: string): BacklogDocument | undefined {
    if (!fs.existsSync(filePath)) return undefined;
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseDocumentContent(content, filePath);
  }

  /**
   * Parse document content from markdown with YAML frontmatter
   */
  parseDocumentContent(content: string, filePath: string): BacklogDocument | undefined {
    const lines = content.split('\n');

    // Extract ID from filename (doc-N pattern)
    const filename = path.basename(filePath, '.md');
    const idMatch = filename.match(/^(doc-\d+)/i);
    const id = idMatch ? idMatch[1].toUpperCase() : filename;

    const doc: BacklogDocument = {
      id,
      title: '',
      tags: [],
      content: '',
      filePath,
    };

    // Parse YAML frontmatter
    let lineIndex = 0;
    if (lines[0]?.trim() === '---') {
      lineIndex = 1;
      const frontmatterLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex]?.trim() !== '---') {
        frontmatterLines.push(lines[lineIndex]);
        lineIndex++;
      }
      lineIndex++; // Skip closing ---

      try {
        const fm = yaml.load(frontmatterLines.join('\n')) as Record<string, unknown> | null;
        if (fm) {
          if (fm.id) doc.id = String(fm.id).toUpperCase();
          if (fm.title) doc.title = String(fm.title);
          if (fm.type) doc.type = String(fm.type) as DocumentType;
          if (fm.tags) doc.tags = this.normalizeStringArray(fm.tags as string | string[]);
          if (fm.created_date || fm.created)
            doc.createdAt = this.normalizeDateValue(fm.created_date || fm.created);
          if (fm.updated_date || fm.updated)
            doc.updatedAt = this.normalizeDateValue(fm.updated_date || fm.updated);
        }
      } catch (error) {
        console.error(
          `[Backlog.md Parser] Error parsing document frontmatter in ${filePath}:`,
          error
        );
      }
    }

    // Body is everything after frontmatter
    const bodyLines = lines.slice(lineIndex);
    doc.content = bodyLines.join('\n').trim();

    // Extract title from first heading if not in frontmatter
    if (!doc.title) {
      const titleLine = bodyLines.find((l) => l.trim().startsWith('# '));
      if (titleLine) {
        doc.title = titleLine.trim().replace(/^#\s+/, '');
      }
    }

    // Fall back to filename-based title
    if (!doc.title) {
      doc.title = filename.replace(/^doc-\d+\s*-\s*/i, '').replace(/-/g, ' ');
    }

    return doc.title ? doc : undefined;
  }

  /**
   * Parse a decision file from backlog/decisions/
   */
  parseDecisionFile(filePath: string): BacklogDecision | undefined {
    if (!fs.existsSync(filePath)) return undefined;
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseDecisionContent(content, filePath);
  }

  /**
   * Parse decision content from markdown with YAML frontmatter
   */
  parseDecisionContent(content: string, filePath: string): BacklogDecision | undefined {
    const lines = content.split('\n');

    // Extract ID from filename (decision-N pattern)
    const filename = path.basename(filePath, '.md');
    const idMatch = filename.match(/^(decision-\d+)/i);
    const id = idMatch ? idMatch[1].toUpperCase() : filename;

    const decision: BacklogDecision = {
      id,
      title: '',
      filePath,
    };

    // Parse YAML frontmatter
    let lineIndex = 0;
    if (lines[0]?.trim() === '---') {
      lineIndex = 1;
      const frontmatterLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex]?.trim() !== '---') {
        frontmatterLines.push(lines[lineIndex]);
        lineIndex++;
      }
      lineIndex++; // Skip closing ---

      try {
        const fm = yaml.load(frontmatterLines.join('\n')) as Record<string, unknown> | null;
        if (fm) {
          if (fm.id) decision.id = String(fm.id).toUpperCase();
          if (fm.title) decision.title = String(fm.title);
          if (fm.date) decision.date = this.normalizeDateValue(fm.date);
          if (fm.status) decision.status = String(fm.status).toLowerCase() as DecisionStatus;
        }
      } catch (error) {
        console.error(
          `[Backlog.md Parser] Error parsing decision frontmatter in ${filePath}:`,
          error
        );
      }
    }

    // Parse body sections (Context, Decision, Consequences, Alternatives)
    let currentSection = '';
    const sections: Record<string, string[]> = {
      context: [],
      decision: [],
      consequences: [],
      alternatives: [],
    };

    for (let i = lineIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Extract title from first heading if not in frontmatter
      if (trimmedLine.startsWith('# ') && !decision.title) {
        decision.title = trimmedLine.replace(/^#\s+/, '');
        continue;
      }

      if (trimmedLine.startsWith('## ')) {
        const sectionName = trimmedLine.substring(3).toLowerCase();
        if (sectionName.includes('context')) {
          currentSection = 'context';
        } else if (sectionName.includes('decision')) {
          currentSection = 'decision';
        } else if (sectionName.includes('consequences')) {
          currentSection = 'consequences';
        } else if (sectionName.includes('alternatives')) {
          currentSection = 'alternatives';
        } else {
          currentSection = '';
        }
        continue;
      }

      if (currentSection && sections[currentSection]) {
        sections[currentSection].push(line);
      }
    }

    decision.context = sections.context.join('\n').trim() || undefined;
    decision.decision = sections.decision.join('\n').trim() || undefined;
    decision.consequences = sections.consequences.join('\n').trim() || undefined;
    decision.alternatives = sections.alternatives.join('\n').trim() || undefined;

    // Fall back to filename-based title
    if (!decision.title) {
      decision.title = filename.replace(/^decision-\d+\s*-\s*/i, '').replace(/-/g, ' ');
    }

    return decision.title ? decision : undefined;
  }
}
