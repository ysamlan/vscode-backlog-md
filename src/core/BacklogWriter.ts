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
  dependencies?: string[];
  references?: string[];
  documentation?: string[];
  type?: string;
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

    // Update status from Draft to To Do
    const content = fs.readFileSync(destPath, 'utf-8');
    const { frontmatter, body } = this.extractFrontmatter(content);
    frontmatter.status = 'To Do';
    frontmatter.updated_date = new Date().toISOString().split('T')[0];
    const updatedContent = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(destPath, updatedContent, 'utf-8');

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

    // Calculate destination path
    const backlogPath = path.dirname(path.dirname(task.filePath)); // backlog/
    const destDir = path.join(backlogPath, destFolder);
    const fileName = path.basename(task.filePath);
    const destPath = path.join(destDir, fileName);

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Move the file
    fs.renameSync(task.filePath, destPath);

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

    // Generate next task ID
    const nextId = this.getNextTaskId(tasksDir);

    // Get task prefix from config, default to "TASK"
    let taskPrefix = 'TASK';
    if (parser) {
      const config = await parser.getConfig();
      taskPrefix = config.task_prefix || 'TASK';
    }
    const taskId = `${taskPrefix}-${nextId}`;

    // Sanitize title for filename
    const sanitizedTitle = options.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const fileName = `task-${nextId} - ${sanitizedTitle}.md`;
    const filePath = path.join(tasksDir, fileName);

    // Build frontmatter
    const frontmatter: FrontmatterData = {
      id: taskId,
      title: options.title,
      status: options.status || 'To Do',
      priority: options.priority,
      labels: options.labels || [],
      milestone: options.milestone,
      assignee: options.assignee || [],
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

    // Build content
    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id: taskId, filePath };
  }

  /**
   * Get the next available task ID number
   */
  private getNextTaskId(tasksDir: string): number {
    const files = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];
    let maxId = 0;

    for (const file of files) {
      const match = file.match(/^task-(\d+)/i);
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
