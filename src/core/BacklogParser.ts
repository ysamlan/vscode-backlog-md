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
  constructor(private backlogPath: string) {}

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

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      try {
        const task = await this.parseTaskFile(filePath);
        if (task) {
          task.folder = folderName as TaskFolder;
          tasks.push(task);
        }
      } catch (error) {
        console.error(`[Backlog.md Parser] Error parsing task file ${file}:`, error);
      }
    }

    console.log(`[Backlog.md Parser] Successfully parsed ${tasks.length} tasks from ${folderName}`);
    return tasks;
  }

  /**
   * Get draft tasks from the drafts/ folder.
   * Enforces status: 'Draft' on all returned tasks.
   */
  async getDrafts(): Promise<Task[]> {
    const tasks = await this.getTasksFromFolder('drafts');
    return tasks.map((t) => ({ ...t, status: 'Draft' as TaskStatus }));
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
    const tasks = await this.getTasksFromFolder('archive/tasks');
    return tasks.map((t) => ({ ...t, folder: 'archive' as TaskFolder }));
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
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(content) as BacklogConfig | null;
      return config || {};
    } catch (error) {
      console.error(`[Backlog.md Parser] Error parsing config file:`, error);
      return {};
    }
  }

  /**
   * Get all milestones from config
   */
  async getMilestones(): Promise<Milestone[]> {
    const config = await this.getConfig();
    return config.milestones || [];
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
    if (!gitService.isGitRepository()) {
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
    const idMatch = filename.match(/^((?:task|draft)-\d+)/i);
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
        const frontmatterYaml = frontmatterLines.join('\n');
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

    for (let i = lineIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

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

      // Parse sections
      if (trimmedLine.startsWith('## ')) {
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
        if (inDescriptionBlock && trimmedLine) {
          descriptionLines.push(line);
        } else if (!inDescriptionBlock && trimmedLine && !trimmedLine.startsWith('<!--')) {
          descriptionLines.push(line);
        }
      } else if (currentSection === 'acceptance') {
        const checkItem = this.parseChecklistItem(trimmedLine);
        if (checkItem) {
          task.acceptanceCriteria.push(checkItem);
        }
      } else if (currentSection === 'dod') {
        const checkItem = this.parseChecklistItem(trimmedLine);
        if (checkItem) {
          task.definitionOfDone.push(checkItem);
        }
      } else if (currentSection === 'notes' && trimmedLine && !trimmedLine.startsWith('<!--')) {
        notesLines.push(line);
      } else if (currentSection === 'summary' && trimmedLine && !trimmedLine.startsWith('<!--')) {
        summaryLines.push(line);
      } else if (currentSection === 'plan' && trimmedLine && !trimmedLine.startsWith('<!--')) {
        planLines.push(line);
      }
    }

    task.description = descriptionLines.join('\n').trim() || undefined;
    task.implementationNotes = notesLines.join('\n').trim() || undefined;
    task.finalSummary = summaryLines.join('\n').trim() || undefined;
    task.plan = planLines.join('\n').trim() || undefined;

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
      task.createdAt = String(fm.created_date || fm.created);
    }
    if (fm.updated_date || fm.updated) {
      task.updatedAt = String(fm.updated_date || fm.updated);
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

  private parseStatus(value: string): TaskStatus {
    const cleanValue = value.replace(/^[○◒●◑]\s*/, '').toLowerCase();

    if (cleanValue.includes('done') || cleanValue.includes('complete')) {
      return 'Done';
    }
    if (cleanValue.includes('progress')) {
      return 'In Progress';
    }
    if (cleanValue.includes('draft')) {
      return 'Draft';
    }
    return 'To Do';
  }

  private parsePriority(value: string): TaskPriority | undefined {
    const lower = value.toLowerCase();
    if (lower.includes('high')) return 'high';
    if (lower.includes('medium')) return 'medium';
    if (lower.includes('low')) return 'low';
    return undefined;
  }

  private parseChecklistItem(line: string): ChecklistItem | undefined {
    // Match patterns like "- [ ] #1 Item text" or "- [x] Item text"
    const match = line.match(/^-\s*\[([ xX])\]\s*(?:#(\d+)\s+)?(.+)$/);
    if (!match) return undefined;

    return {
      id: match[2] ? parseInt(match[2], 10) : Date.now(),
      checked: match[1].toLowerCase() === 'x',
      text: match[3].trim(),
    };
  }
}
