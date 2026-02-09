import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { Task, TaskStatus } from './types';
import { BacklogParser } from './BacklogParser';

/**
 * Compute an MD5 hash of file content for conflict detection
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Error thrown when a file has been modified externally
 */
export class FileConflictError extends Error {
  code = 'CONFLICT' as const;
  currentContent: string;

  constructor(message: string, currentContent: string) {
    super(message);
    this.name = 'FileConflictError';
    this.currentContent = currentContent;
  }
}

/**
 * Options for creating a new task
 */
export interface CreateTaskOptions {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: 'high' | 'medium' | 'low';
  labels?: string[];
  milestone?: string;
  assignee?: string[];
}

/**
 * Raw frontmatter structure for YAML serialization
 */
interface FrontmatterData {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  milestone?: string;
  labels?: string[];
  assignee?: string[];
  reporter?: string;
  dependencies?: string[];
  references?: string[];
  documentation?: string[];
  type?: string;
  parent_task_id?: string;
  subtasks?: string[];
  created_date?: string;
  updated_date?: string;
  ordinal?: number;
  [key: string]: unknown;
}

/**
 * Writes changes back to Backlog.md task files
 */
export class BacklogWriter {
  /**
   * Move a completed task to the completed/ folder
   */
  async completeTask(taskId: string, parser: BacklogParser): Promise<string> {
    return this.moveTaskToFolder(taskId, 'completed', parser);
  }

  /**
   * Archive a task (cancelled/duplicate) to the archive/tasks/ folder
   */
  async archiveTask(taskId: string, parser: BacklogParser): Promise<string> {
    return this.moveTaskToFolder(taskId, 'archive/tasks', parser);
  }

  /**
   * Restore an archived task: moves from archive/tasks/ back to tasks/
   */
  async restoreArchivedTask(taskId: string, parser: BacklogParser): Promise<string> {
    return this.moveTaskToFolder(taskId, 'tasks', parser);
  }

  /**
   * Permanently delete a task file from disk
   */
  async deleteTask(taskId: string, parser: BacklogParser): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    fs.unlinkSync(task.filePath);
    parser.invalidateTaskCache(task.filePath);
  }

  /**
   * Promote a draft to a regular task: moves from drafts/ to tasks/, updates status to 'To Do'
   */
  async promoteDraft(taskId: string, parser: BacklogParser): Promise<string> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Move file from drafts/ to tasks/
    const backlogPath = path.dirname(path.dirname(task.filePath));
    const destDir = path.join(backlogPath, 'tasks');
    const fileName = path.basename(task.filePath);
    const destPath = path.join(destDir, fileName);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(task.filePath, destPath);
    parser.invalidateTaskCache(task.filePath);

    // Update status from Draft to config default or 'To Do'
    const config = await parser.getConfig();
    const content = fs.readFileSync(destPath, 'utf-8');
    const { frontmatter, body } = this.extractFrontmatter(content);
    frontmatter.status = config.default_status || 'To Do';
    frontmatter.updated_date = new Date().toISOString().split('T')[0];
    const updatedContent = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(destPath, updatedContent, 'utf-8');
    parser.invalidateTaskCache(destPath);

    return destPath;
  }

  /**
   * Move a task file to a destination folder
   */
  private async moveTaskToFolder(
    taskId: string,
    destFolder: string,
    parser: BacklogParser
  ): Promise<string> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Calculate destination path - go up from file to backlog root
    // Files in archive/tasks/ are 3 levels deep, others are 2 levels deep
    const isArchived = task.filePath.includes(path.join('archive', 'tasks'));
    const backlogPath = isArchived
      ? path.dirname(path.dirname(path.dirname(task.filePath))) // backlog/archive/tasks/file -> backlog/
      : path.dirname(path.dirname(task.filePath)); // backlog/tasks/file -> backlog/
    const destDir = path.join(backlogPath, destFolder);
    const fileName = path.basename(task.filePath);
    const destPath = path.join(destDir, fileName);

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Move the file
    fs.renameSync(task.filePath, destPath);
    parser.invalidateTaskCache(task.filePath);
    parser.invalidateTaskCache(destPath);

    return destPath;
  }

  /**
   * Update a task's status in its file
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    parser: BacklogParser
  ): Promise<void> {
    await this.updateTask(taskId, { status: newStatus }, parser);
  }

  /**
   * Update a task with partial changes
   * @param taskId - The ID of the task to update
   * @param updates - Partial task fields to update
   * @param parser - BacklogParser instance
   * @param expectedHash - Optional hash of the file content when it was loaded.
   *                       If provided, the update will fail with FileConflictError
   *                       if the file has been modified externally.
   */
  async updateTask(
    taskId: string,
    updates: Partial<Task>,
    parser: BacklogParser,
    expectedHash?: string
  ): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const content = fs.readFileSync(task.filePath, 'utf-8');

    // Conflict detection: if expectedHash is provided, verify file hasn't changed
    if (expectedHash) {
      const currentHash = computeContentHash(content);
      if (currentHash !== expectedHash) {
        throw new FileConflictError('File has been modified externally', content);
      }
    }

    const { frontmatter, body } = this.extractFrontmatter(content);

    // Apply updates to frontmatter
    if (updates.status !== undefined) {
      frontmatter.status = updates.status;
    }
    if (updates.priority !== undefined) {
      frontmatter.priority = updates.priority;
    }
    if (updates.title !== undefined) {
      frontmatter.title = updates.title;
    }
    if (updates.labels !== undefined) {
      frontmatter.labels = updates.labels;
    }
    if (updates.milestone !== undefined) {
      frontmatter.milestone = updates.milestone;
    }
    if (updates.assignee !== undefined) {
      frontmatter.assignee = updates.assignee;
    }
    if (updates.dependencies !== undefined) {
      frontmatter.dependencies = updates.dependencies;
    }
    if (updates.references !== undefined) {
      frontmatter.references = updates.references;
    }
    if (updates.documentation !== undefined) {
      frontmatter.documentation = updates.documentation;
    }
    if (updates.type !== undefined) {
      frontmatter.type = updates.type;
    }
    if (updates.reporter !== undefined) {
      frontmatter.reporter = updates.reporter;
    }
    if (updates.ordinal !== undefined) {
      frontmatter.ordinal = updates.ordinal;
    }

    // Update the updated_date
    frontmatter.updated_date = new Date().toISOString().split('T')[0];

    // Handle description update (stored in body, not frontmatter)
    let updatedBody = body;
    if (updates.description !== undefined) {
      updatedBody = this.updateDescriptionInBody(body, updates.description);
    }

    // Reconstruct the file
    const updatedContent = this.reconstructFile(frontmatter, updatedBody);
    fs.writeFileSync(task.filePath, updatedContent, 'utf-8');
    parser.invalidateTaskCache(task.filePath);
  }

  /**
   * Create a new task file
   * @param backlogPath - Path to the backlog directory
   * @param options - Task creation options
   * @param parser - Optional parser to read config for task_prefix
   */
  async createTask(
    backlogPath: string,
    options: CreateTaskOptions,
    parser?: BacklogParser
  ): Promise<{ id: string; filePath: string }> {
    const tasksDir = path.join(backlogPath, 'tasks');

    // Ensure tasks directory exists
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }

    // Get config for prefix, padding, and defaults
    const config = parser ? await parser.getConfig() : {};
    const taskPrefix = config.task_prefix || 'TASK';
    const zeroPadding = config.zero_padded_ids || 0;

    // Generate next task ID
    const nextId = this.getNextTaskId(tasksDir, taskPrefix);
    const paddedId = zeroPadding > 0 ? String(nextId).padStart(zeroPadding, '0') : String(nextId);
    const taskId = `${taskPrefix}-${paddedId}`.toUpperCase();
    const lowerPrefix = taskPrefix.toLowerCase();

    // Sanitize title for filename
    const sanitizedTitle = options.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const fileName = `${lowerPrefix}-${paddedId} - ${sanitizedTitle}.md`;
    const filePath = path.join(tasksDir, fileName);

    // Build frontmatter with config defaults
    const frontmatter: FrontmatterData = {
      id: taskId,
      title: options.title,
      status: options.status || config.default_status || 'To Do',
      priority: options.priority,
      labels: options.labels || [],
      milestone: options.milestone,
      assignee: options.assignee || (config.default_assignee ? [config.default_assignee] : []),
      reporter: config.default_reporter,
      dependencies: [],
      created_date: new Date().toISOString().split('T')[0],
      updated_date: new Date().toISOString().split('T')[0],
    };

    // Remove undefined values
    Object.keys(frontmatter).forEach((key) => {
      if (frontmatter[key] === undefined) {
        delete frontmatter[key];
      }
    });

    // Build body
    let body = '\n## Description\n\n';
    if (options.description) {
      body += `<!-- SECTION:DESCRIPTION:BEGIN -->\n${options.description}\n<!-- SECTION:DESCRIPTION:END -->\n`;
    } else {
      body += '<!-- SECTION:DESCRIPTION:BEGIN -->\n<!-- SECTION:DESCRIPTION:END -->\n';
    }
    body += '\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n<!-- AC:END -->\n';

    // Add Definition of Done from config defaults
    if (config.definition_of_done && config.definition_of_done.length > 0) {
      body += '\n## Definition of Done\n<!-- DOD:BEGIN -->\n';
      config.definition_of_done.forEach((item, index) => {
        body += `- [ ] #${index + 1} ${item}\n`;
      });
      body += '<!-- DOD:END -->\n';
    }

    // Build content
    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id: taskId, filePath };
  }

  /**
   * Create a new draft file in the drafts/ directory
   * @param backlogPath - Path to the backlog directory
   * @param parser - Optional parser to read config
   */
  async createDraft(
    backlogPath: string,
    _parser?: BacklogParser
  ): Promise<{ id: string; filePath: string }> {
    const draftsDir = path.join(backlogPath, 'drafts');

    // Ensure drafts directory exists
    if (!fs.existsSync(draftsDir)) {
      fs.mkdirSync(draftsDir, { recursive: true });
    }

    // Generate next draft ID
    const nextId = this.getNextDraftId(draftsDir);
    const draftId = `DRAFT-${nextId}`;

    const fileName = `draft-${nextId} - Untitled.md`;
    const filePath = path.join(draftsDir, fileName);

    // Build frontmatter
    const today = new Date().toISOString().split('T')[0];
    const frontmatter: FrontmatterData = {
      id: draftId,
      title: 'Untitled',
      status: 'Draft',
      labels: [],
      assignee: [],
      dependencies: [],
      created_date: today,
      updated_date: today,
    };

    // Build body
    const body =
      '\n## Description\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n<!-- SECTION:DESCRIPTION:END -->\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n<!-- AC:END -->\n';

    // Build content
    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id: draftId, filePath };
  }

  /**
   * Get the next available draft ID number
   */
  private getNextDraftId(draftsDir: string): number {
    const files = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir) : [];
    let maxId = 0;

    for (const file of files) {
      const match = file.match(/^draft-(\d+)/i);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > maxId) {
          maxId = id;
        }
      }
    }

    return maxId + 1;
  }

  /**
   * Create a subtask under a parent task.
   * Uses dot-notation IDs (e.g., TASK-2.1, TASK-2.2).
   * Scans existing tasks to find the next sub-number, handling gaps.
   */
  async createSubtask(
    parentTaskId: string,
    backlogPath: string,
    parser?: BacklogParser
  ): Promise<{ id: string; filePath: string }> {
    const tasksDir = path.join(backlogPath, 'tasks');

    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }

    // Extract the numeric part from parent ID (e.g., "TASK-2" -> "2", "TASK-10" -> "10")
    const parentNumMatch = parentTaskId.match(/(\d+)$/);
    if (!parentNumMatch) {
      throw new Error(`Cannot extract numeric ID from parent: ${parentTaskId}`);
    }
    const parentNum = parentNumMatch[1];

    // Get task prefix from parent ID (e.g., "TASK-2" -> "TASK")
    const prefixMatch = parentTaskId.match(/^(.+)-\d+$/);
    const taskPrefix = prefixMatch ? prefixMatch[1] : 'TASK';
    const lowerPrefix = taskPrefix.toLowerCase();

    // Scan existing files for subtask numbering (prefix-N.M pattern)
    const files = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];
    let maxSubId = 0;
    const subPattern = new RegExp(`^${lowerPrefix}-${parentNum}\\.(\\d+)`, 'i');
    for (const file of files) {
      const match = file.match(subPattern);
      if (match) {
        const subId = parseInt(match[1], 10);
        if (subId > maxSubId) maxSubId = subId;
      }
    }
    const nextSubId = maxSubId + 1;

    const taskId = `${taskPrefix}-${parentNum}.${nextSubId}`.toUpperCase();
    const fileName = `${lowerPrefix}-${parentNum}.${nextSubId} - Untitled.md`;
    const filePath = path.join(tasksDir, fileName);

    // Get config defaults
    const config = parser ? await parser.getConfig() : {};

    const today = new Date().toISOString().split('T')[0];
    const frontmatter: FrontmatterData = {
      id: taskId,
      title: 'Untitled',
      status: config.default_status || 'To Do',
      labels: [],
      assignee: config.default_assignee ? [config.default_assignee] : [],
      reporter: config.default_reporter,
      dependencies: [],
      parent_task_id: parentTaskId,
      created_date: today,
      updated_date: today,
    };

    // Remove undefined values
    Object.keys(frontmatter).forEach((key) => {
      if (frontmatter[key] === undefined) {
        delete frontmatter[key];
      }
    });

    let body =
      '\n## Description\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n<!-- SECTION:DESCRIPTION:END -->\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n<!-- AC:END -->\n';

    // Add Definition of Done from config defaults
    if (config.definition_of_done && config.definition_of_done.length > 0) {
      body += '\n## Definition of Done\n<!-- DOD:BEGIN -->\n';
      config.definition_of_done.forEach((item, index) => {
        body += `- [ ] #${index + 1} ${item}\n`;
      });
      body += '<!-- DOD:END -->\n';
    }

    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id: taskId, filePath };
  }

  /**
   * Get the next available task ID number
   */
  private getNextTaskId(tasksDir: string, prefix: string = 'task'): number {
    const files = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];
    let maxId = 0;

    const pattern = new RegExp(`^${prefix}-(\\d+)`, 'i');
    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > maxId) {
          maxId = id;
        }
      }
    }

    return maxId + 1;
  }

  /**
   * Update description content in the markdown body
   */
  private updateDescriptionInBody(body: string, newDescription: string): string {
    const beginMarker = '<!-- SECTION:DESCRIPTION:BEGIN -->';
    const endMarker = '<!-- SECTION:DESCRIPTION:END -->';

    const beginIndex = body.indexOf(beginMarker);
    const endIndex = body.indexOf(endMarker);

    if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
      // Replace content between markers
      const before = body.substring(0, beginIndex + beginMarker.length);
      const after = body.substring(endIndex);
      return `${before}\n${newDescription}\n${after}`;
    }

    // No markers found - look for ## Description section and add markers
    const descriptionHeaderRegex = /^## Description\s*$/m;
    const match = body.match(descriptionHeaderRegex);

    if (match && match.index !== undefined) {
      // Find the next section header or end of file
      const afterHeader = body.substring(match.index + match[0].length);
      const nextSectionMatch = afterHeader.match(/^## /m);
      const nextSectionIndex = nextSectionMatch?.index ?? afterHeader.length;

      const before = body.substring(0, match.index + match[0].length);
      const after = body.substring(match.index + match[0].length + nextSectionIndex);

      return `${before}\n\n${beginMarker}\n${newDescription}\n${endMarker}\n${after}`;
    }

    // No description section - add one after frontmatter
    return `\n## Description\n\n${beginMarker}\n${newDescription}\n${endMarker}\n${body}`;
  }

  /**
   * Toggle a checklist item
   */
  async toggleChecklistItem(
    taskId: string,
    _listType: 'acceptanceCriteria' | 'definitionOfDone',
    itemId: number,
    parser: BacklogParser
  ): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let content = fs.readFileSync(task.filePath, 'utf-8');

    // Find and toggle the specific checklist item by its #id
    // This is in the markdown body, not YAML, so regex is appropriate here
    const regex = new RegExp(`^(- \\[)([ xX])(\\]\\s*#${itemId}\\s+.*)$`, 'gm');
    content = content.replace(regex, (_match, prefix, check, suffix) => {
      const newCheck = check === ' ' ? 'x' : ' ';
      return `${prefix}${newCheck}${suffix}`;
    });

    fs.writeFileSync(task.filePath, content, 'utf-8');
    parser.invalidateTaskCache(task.filePath);
  }

  /**
   * Extract YAML frontmatter and body from file content
   */
  private extractFrontmatter(content: string): { frontmatter: FrontmatterData; body: string } {
    const lines = content.split('\n');

    if (lines[0]?.trim() !== '---') {
      // No frontmatter, return empty object and full content as body
      return { frontmatter: {}, body: content };
    }

    // Find closing ---
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      // Malformed frontmatter
      return { frontmatter: {}, body: content };
    }

    const frontmatterYaml = lines.slice(1, endIndex).join('\n');
    const body = lines.slice(endIndex + 1).join('\n');

    try {
      // Use JSON_SCHEMA to prevent date strings from being parsed as Date objects
      const frontmatter =
        (yaml.load(frontmatterYaml, { schema: yaml.JSON_SCHEMA }) as FrontmatterData) || {};
      return { frontmatter, body };
    } catch {
      return { frontmatter: {}, body: content };
    }
  }

  /**
   * Reconstruct file from frontmatter and body
   * Outputs frontmatter in a format compatible with upstream Backlog.md:
   * - Dates as YYYY-MM-DD strings
   * - Arrays in inline format [item1, item2]
   */
  private reconstructFile(frontmatter: FrontmatterData, body: string): string {
    // Build YAML manually to match upstream Backlog.md format
    const lines: string[] = [];

    // Define field order to match upstream convention
    const fieldOrder = [
      'id',
      'title',
      'status',
      'priority',
      'milestone',
      'labels',
      'assignee',
      'reporter',
      'created',
      'created_date',
      'updated_date',
      'dependencies',
      'references',
      'documentation',
      'parent_task_id',
      'subtasks',
      'ordinal',
      'type',
      'onStatusChange',
    ];

    // First output fields in the defined order
    for (const key of fieldOrder) {
      if (key in frontmatter && frontmatter[key] !== undefined) {
        lines.push(this.formatYamlField(key, frontmatter[key]));
      }
    }

    // Then output any remaining fields not in the order list
    for (const key of Object.keys(frontmatter)) {
      if (!fieldOrder.includes(key) && frontmatter[key] !== undefined) {
        lines.push(this.formatYamlField(key, frontmatter[key]));
      }
    }

    const yamlContent = lines.join('\n') + '\n';
    return `---\n${yamlContent}---\n${body}`;
  }

  /**
   * Format a single YAML field in upstream-compatible format
   */
  private formatYamlField(key: string, value: unknown): string {
    if (value === null || value === undefined) {
      return `${key}: `;
    }

    if (Array.isArray(value)) {
      // Use inline array format [item1, item2] like upstream
      if (value.length === 0) {
        return `${key}: []`;
      }
      const items = value.map((item) => this.formatYamlValue(item)).join(', ');
      return `${key}: [${items}]`;
    }

    if (typeof value === 'object') {
      // For objects, use yaml.dump but inline
      const dumped = yaml.dump(value, { flowLevel: 0 }).trim();
      return `${key}: ${dumped}`;
    }

    return `${key}: ${this.formatYamlValue(value)}`;
  }

  /**
   * Format a YAML value, quoting strings if necessary
   */
  private formatYamlValue(value: unknown): string {
    if (typeof value === 'string') {
      // Quote if contains special characters or looks like other YAML types
      if (
        value.includes(':') ||
        value.includes('#') ||
        value.includes('[') ||
        value.includes(']') ||
        value.includes('{') ||
        value.includes('}') ||
        value.includes(',') ||
        value.includes("'") ||
        value.includes('"') ||
        value.includes('\n') ||
        value.startsWith('@') ||
        value.startsWith('*') ||
        value.startsWith('&') ||
        value.startsWith('!') ||
        value === 'true' ||
        value === 'false' ||
        value === 'null' ||
        value === 'yes' ||
        value === 'no' ||
        value === ''
      ) {
        // Use double quotes and escape internal quotes
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return String(value);
  }
}
