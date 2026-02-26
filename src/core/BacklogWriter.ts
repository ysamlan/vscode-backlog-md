import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { Milestone, Task, TaskStatus } from './types';
import { BacklogParser } from './BacklogParser';

/**
 * Compute an MD5 hash of file content for conflict detection
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Detect whether content uses CRLF line endings.
 * Returns true if the content contains \r\n (CRLF).
 */
export function detectCRLF(content: string): boolean {
  return content.includes('\r\n');
}

/**
 * Normalize line endings to LF for internal processing.
 */
export function normalizeToLF(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/**
 * Restore CRLF line endings if the original content used them.
 */
export function restoreLineEndings(content: string, useCRLF: boolean): string {
  if (!useCRLF) return content;
  return content.replace(/\n/g, '\r\n');
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
   * Create a new milestone file in backlog/milestones.
   * Mirrors upstream ID allocation semantics by scanning both active and archived milestone files.
   */
  async createMilestone(
    backlogPath: string,
    title: string,
    description?: string,
    parser?: BacklogParser
  ): Promise<Milestone> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error('Milestone title is required');
    }

    const existingMilestones = parser ? await parser.getMilestones() : [];
    const requestedKeys = this.buildMilestoneIdentifierKeys(normalizedTitle);
    const duplicate = existingMilestones.find((milestone) => {
      const milestoneKeys = new Set<string>([
        ...this.buildMilestoneIdentifierKeys(milestone.id),
        ...this.buildMilestoneIdentifierKeys(milestone.name),
      ]);
      for (const key of requestedKeys) {
        if (milestoneKeys.has(key)) {
          return true;
        }
      }
      return false;
    });
    if (duplicate) {
      throw new Error('A milestone with this title or ID already exists');
    }

    const milestonesDir = path.join(backlogPath, 'milestones');
    const archivedMilestonesDir = path.join(backlogPath, 'archive', 'milestones');
    if (!fs.existsSync(milestonesDir)) {
      fs.mkdirSync(milestonesDir, { recursive: true });
    }
    const nextIdNumber = this.getNextMilestoneId(milestonesDir, archivedMilestonesDir);
    const id = `m-${nextIdNumber}`;
    const safeTitle = this.sanitizeMilestoneTitle(normalizedTitle);
    const filename = `${id} - ${safeTitle}.md`;
    const filePath = path.join(milestonesDir, filename);
    const milestoneDescription = description?.trim() || `Milestone: ${normalizedTitle}`;

    const frontmatter: FrontmatterData = { id, title: normalizedTitle };
    const body = `\n## Description\n\n${milestoneDescription}\n`;
    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id, name: normalizedTitle, description: milestoneDescription };
  }

  /**
   * Delete a milestone file from disk.
   */
  async deleteMilestone(milestoneId: string, parser: BacklogParser): Promise<void> {
    const milestones = await parser.getMilestones();
    const milestone = milestones.find(
      (m) => m.id.toLowerCase() === milestoneId.toLowerCase()
    );
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const milestonesDir = path.join(parser.getBacklogPath(), 'milestones');
    const files = fs.existsSync(milestonesDir) ? fs.readdirSync(milestonesDir) : [];
    const file = files.find((f) => f.toLowerCase().startsWith(milestone.id.toLowerCase()));
    if (!file) {
      throw new Error(`Milestone file for ${milestoneId} not found`);
    }

    fs.unlinkSync(path.join(milestonesDir, file));
    parser.invalidateMilestoneCache();
  }

  /**
   * Archive a milestone file to archive/milestones/.
   */
  async archiveMilestone(milestoneId: string, parser: BacklogParser): Promise<void> {
    const milestones = await parser.getMilestones();
    const milestone = milestones.find(
      (m) => m.id.toLowerCase() === milestoneId.toLowerCase()
    );
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const backlogPath = parser.getBacklogPath();
    const milestonesDir = path.join(backlogPath, 'milestones');
    const archiveDir = path.join(backlogPath, 'archive', 'milestones');

    const files = fs.existsSync(milestonesDir) ? fs.readdirSync(milestonesDir) : [];
    const file = files.find((f) => f.toLowerCase().startsWith(milestone.id.toLowerCase()));
    if (!file) {
      throw new Error(`Milestone file for ${milestoneId} not found`);
    }

    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    fs.renameSync(path.join(milestonesDir, file), path.join(archiveDir, file));
    parser.invalidateMilestoneCache();
  }

  /**
   * Rename a milestone: updates the milestone file and all tasks referencing it.
   */
  async renameMilestone(
    milestoneId: string,
    newName: string,
    parser: BacklogParser
  ): Promise<void> {
    const milestones = await parser.getMilestones();
    const milestone = milestones.find(
      (m) => m.id.toLowerCase() === milestoneId.toLowerCase()
    );
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const backlogPath = parser.getBacklogPath();
    const milestonesDir = path.join(backlogPath, 'milestones');

    const files = fs.existsSync(milestonesDir) ? fs.readdirSync(milestonesDir) : [];
    const file = files.find((f) => f.toLowerCase().startsWith(milestone.id.toLowerCase()));
    if (!file) {
      throw new Error(`Milestone file for ${milestoneId} not found`);
    }

    const filePath = path.join(milestonesDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);
    const { frontmatter, body } = this.extractFrontmatter(content);

    const oldName = milestone.name;
    frontmatter.title = newName.trim();
    const updatedContent = restoreLineEndings(
      this.reconstructFile(frontmatter, body),
      hasCRLF
    );

    // Rename the milestone file
    const safeTitle = this.sanitizeMilestoneTitle(newName.trim());
    const newFileName = `${milestone.id} - ${safeTitle}.md`;
    const newFilePath = path.join(milestonesDir, newFileName);
    fs.writeFileSync(newFilePath, updatedContent, 'utf-8');
    if (newFilePath !== filePath) {
      fs.unlinkSync(filePath);
    }

    // Update all tasks that reference the old milestone name or ID
    const tasks = await parser.getTasks();
    for (const task of tasks) {
      if (
        task.milestone &&
        (task.milestone === oldName ||
          task.milestone.toLowerCase() === milestone.id.toLowerCase())
      ) {
        await this.updateTask(task.id, { milestone: milestone.id }, parser);
      }
    }

    parser.invalidateMilestoneCache();
  }

  /**
   * Update a milestone's description.
   */
  async updateMilestone(
    milestoneId: string,
    updates: { title?: string; description?: string },
    parser: BacklogParser
  ): Promise<void> {
    const milestones = await parser.getMilestones();
    const milestone = milestones.find(
      (m) => m.id.toLowerCase() === milestoneId.toLowerCase()
    );
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const milestonesDir = path.join(parser.getBacklogPath(), 'milestones');
    const files = fs.existsSync(milestonesDir) ? fs.readdirSync(milestonesDir) : [];
    const file = files.find((f) => f.toLowerCase().startsWith(milestone.id.toLowerCase()));
    if (!file) {
      throw new Error(`Milestone file for ${milestoneId} not found`);
    }

    const filePath = path.join(milestonesDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);
    const { frontmatter, body } = this.extractFrontmatter(content);

    if (updates.title) {
      frontmatter.title = updates.title.trim();
    }

    let updatedBody = body;
    if (updates.description !== undefined) {
      // Replace description section content
      const descRegex = /^## Description\n\n[\s\S]*$/m;
      if (descRegex.test(updatedBody)) {
        updatedBody = updatedBody.replace(
          /^(## Description\n\n)[\s\S]*$/m,
          `$1${updates.description}\n`
        );
      } else {
        updatedBody = `\n## Description\n\n${updates.description}\n`;
      }
    }

    const updatedContent = restoreLineEndings(
      this.reconstructFile(frontmatter, updatedBody),
      hasCRLF
    );
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    parser.invalidateMilestoneCache();
  }

  /**
   * Move a completed task to the completed/ folder
   */
  async completeTask(taskId: string, parser: BacklogParser): Promise<string> {
    const destinationPath = await this.moveTaskToFolder(taskId, 'completed', parser);
    await this.sanitizeArchivedTaskLinks(taskId, parser);
    return destinationPath;
  }

  /**
   * Archive a task (cancelled/duplicate) to the archive/tasks/ folder
   */
  async archiveTask(taskId: string, parser: BacklogParser): Promise<string> {
    const destinationPath = await this.moveTaskToFolder(taskId, 'archive/tasks', parser);
    await this.sanitizeArchivedTaskLinks(taskId, parser);
    return destinationPath;
  }

  /**
   * Restore an archived task: moves from archive/tasks/ back to tasks/ (or drafts/ for DRAFT- IDs)
   */
  async restoreArchivedTask(taskId: string, parser: BacklogParser): Promise<string> {
    const destFolder = taskId.startsWith('DRAFT-') ? 'drafts' : 'tasks';
    return this.moveTaskToFolder(taskId, destFolder, parser);
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
   * Promote a draft to a regular task: assigns new TASK-N ID, moves from drafts/ to tasks/,
   * and updates status to the config default (or 'To Do').
   */
  async promoteDraft(
    taskId: string,
    parser: BacklogParser,
    crossBranchIds?: string[]
  ): Promise<string> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const backlogPath = path.dirname(path.dirname(task.filePath));
    const destDir = path.join(backlogPath, 'tasks');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Generate a new task ID
    const config = await parser.getConfig();
    const taskPrefix = config.task_prefix || 'TASK';
    const zeroPadding = config.zero_padded_ids || 0;
    const nextId = this.getNextTaskId(destDir, taskPrefix, crossBranchIds);
    const paddedId = zeroPadding > 0 ? String(nextId).padStart(zeroPadding, '0') : String(nextId);
    const newTaskId = `${taskPrefix}-${paddedId}`.toUpperCase();
    const lowerPrefix = taskPrefix.toLowerCase();

    // Build new filename from task title
    const sanitizedTitle = (task.title || 'Untitled')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const newFileName = `${lowerPrefix}-${paddedId} - ${sanitizedTitle}.md`;
    const destPath = path.join(destDir, newFileName);

    // Move draft file to tasks/ with new name
    fs.renameSync(task.filePath, destPath);
    parser.invalidateTaskCache(task.filePath);

    // Update frontmatter: new ID, status, and updated_date
    const rawContent = fs.readFileSync(destPath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);
    const { frontmatter, body } = this.extractFrontmatter(content);
    frontmatter.id = newTaskId;
    frontmatter.status = config.default_status || 'To Do';
    frontmatter.updated_date = new Date().toISOString().split('T')[0];
    const updatedContent = restoreLineEndings(this.reconstructFile(frontmatter, body), hasCRLF);
    fs.writeFileSync(destPath, updatedContent, 'utf-8');
    parser.invalidateTaskCache(destPath);

    return newTaskId;
  }

  /**
   * Demote a task to a draft: assigns new DRAFT-N ID, moves from tasks/ to drafts/,
   * and sets status to "Draft". Mirrors upstream Backlog.md demote semantics.
   */
  async demoteTask(taskId: string, parser: BacklogParser): Promise<string> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const backlogPath = path.dirname(path.dirname(task.filePath));
    const destDir = path.join(backlogPath, 'drafts');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Generate a new draft ID
    const nextId = this.getNextDraftId(destDir);
    const newDraftId = `DRAFT-${nextId}`;

    // Build new filename from task title
    const sanitizedTitle = (task.title || 'Untitled')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const newFileName = `draft-${nextId} - ${sanitizedTitle}.md`;
    const destPath = path.join(destDir, newFileName);

    // Move task file to drafts/ with new name
    fs.renameSync(task.filePath, destPath);
    parser.invalidateTaskCache(task.filePath);

    // Update frontmatter: new ID, status Draft, and updated_date
    const rawContent = fs.readFileSync(destPath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);
    const { frontmatter, body } = this.extractFrontmatter(content);
    frontmatter.id = newDraftId;
    frontmatter.status = 'Draft';
    frontmatter.updated_date = new Date().toISOString().split('T')[0];
    const updatedContent = restoreLineEndings(this.reconstructFile(frontmatter, body), hasCRLF);
    fs.writeFileSync(destPath, updatedContent, 'utf-8');
    parser.invalidateTaskCache(destPath);

    return newDraftId;
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
   * After archiving a task, remove its ID from dependencies and exact-ID references
   * in active tasks to mirror upstream cleanup semantics.
   */
  private async sanitizeArchivedTaskLinks(taskId: string, parser: BacklogParser): Promise<void> {
    const activeTasks = await parser.getTasks();

    for (const activeTask of activeTasks) {
      const existingDependencies = activeTask.dependencies ?? [];
      const existingReferences = activeTask.references ?? [];

      const nextDependencies = existingDependencies.filter(
        (dependencyId) => !this.areTaskIdsEqual(dependencyId, taskId)
      );
      const nextReferences = existingReferences.filter(
        (reference) => !this.areTaskIdsEqual(reference, taskId)
      );

      const dependenciesChanged = existingDependencies.length !== nextDependencies.length;
      const referencesChanged = existingReferences.length !== nextReferences.length;

      if (!dependenciesChanged && !referencesChanged) {
        continue;
      }

      await this.updateTask(
        activeTask.id,
        {
          dependencies: nextDependencies,
          references: nextReferences,
        },
        parser
      );
    }
  }

  private areTaskIdsEqual(left: string, right: string): boolean {
    return left.trim().toUpperCase() === right.trim().toUpperCase();
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

    const rawContent = fs.readFileSync(task.filePath, 'utf-8');

    // Conflict detection: if expectedHash is provided, verify file hasn't changed
    if (expectedHash) {
      const currentHash = computeContentHash(rawContent);
      if (currentHash !== expectedHash) {
        throw new FileConflictError('File has been modified externally', rawContent);
      }
    }

    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);

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

    // Handle body updates (description, AC, DoD are stored in body, not frontmatter)
    let updatedBody = body;
    if (updates.description !== undefined) {
      updatedBody = this.updateDescriptionInBody(updatedBody, updates.description);
    }
    if ((updates as Record<string, unknown>).acceptanceCriteria !== undefined) {
      updatedBody = this.updateChecklistInBody(
        updatedBody,
        'acceptanceCriteria',
        String((updates as Record<string, unknown>).acceptanceCriteria)
      );
    }
    if ((updates as Record<string, unknown>).definitionOfDone !== undefined) {
      updatedBody = this.updateChecklistInBody(
        updatedBody,
        'definitionOfDone',
        String((updates as Record<string, unknown>).definitionOfDone)
      );
    }
    if (updates.implementationPlan !== undefined) {
      updatedBody = this.updateStructuredSectionInBody(
        updatedBody,
        'implementationPlan',
        updates.implementationPlan
      );
    }
    if (updates.implementationNotes !== undefined) {
      updatedBody = this.updateStructuredSectionInBody(
        updatedBody,
        'implementationNotes',
        updates.implementationNotes
      );
    }
    if (updates.finalSummary !== undefined) {
      updatedBody = this.updateStructuredSectionInBody(
        updatedBody,
        'finalSummary',
        updates.finalSummary
      );
    }

    // Reconstruct the file, preserving original line endings
    const updatedContent = restoreLineEndings(
      this.reconstructFile(frontmatter, updatedBody),
      hasCRLF
    );
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
    parser?: BacklogParser,
    crossBranchIds?: string[]
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

    // Generate next task ID (considering cross-branch IDs to avoid collisions)
    const nextId = this.getNextTaskId(tasksDir, taskPrefix, crossBranchIds);
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
   * Get the next available task ID number.
   * Optionally scans cross-branch task IDs to avoid collisions.
   */
  private getNextTaskId(
    tasksDir: string,
    prefix: string = 'task',
    crossBranchIds?: string[]
  ): number {
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

    // Also check cross-branch task IDs to avoid collisions
    if (crossBranchIds) {
      const idPattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
      for (const taskId of crossBranchIds) {
        const match = taskId.match(idPattern);
        if (match) {
          const id = parseInt(match[1], 10);
          if (id > maxId) {
            maxId = id;
          }
        }
      }
    }

    return maxId + 1;
  }

  private getNextMilestoneId(milestonesDir: string, archivedMilestonesDir: string): number {
    const ids = [
      ...this.extractMilestoneIdsFromDirectory(milestonesDir),
      ...this.extractMilestoneIdsFromDirectory(archivedMilestonesDir),
    ];
    if (ids.length === 0) {
      return 0;
    }
    return Math.max(...ids) + 1;
  }

  private extractMilestoneIdsFromDirectory(dirPath: string): number[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const files = fs
      .readdirSync(dirPath)
      .filter(
        (file) => file.endsWith('.md') && /^m-\d+/i.test(file) && file.toLowerCase() !== 'readme.md'
      );

    const ids: number[] = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      let candidateId = '';

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontmatter } = this.extractFrontmatter(content);
        candidateId = String(frontmatter.id || '')
          .trim()
          .toLowerCase();
      } catch {
        // candidateId remains '' from initialization
      }

      if (!candidateId) {
        const fallback = file.match(/^(m-\d+)/i)?.[1];
        candidateId = String(fallback || '').toLowerCase();
      }

      const match = candidateId.match(/^m-(\d+)$/i);
      if (!match?.[1]) {
        continue;
      }
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        ids.push(parsed);
      }
    }

    return ids;
  }

  private buildMilestoneIdentifierKeys(value: string): Set<string> {
    const normalized = value.trim().toLowerCase();
    const keys = new Set<string>();
    if (!normalized) {
      return keys;
    }

    keys.add(normalized);

    if (/^\d+$/.test(normalized)) {
      const numeric = String(Number.parseInt(normalized, 10));
      keys.add(numeric);
      keys.add(`m-${numeric}`);
      return keys;
    }

    const idMatch = normalized.match(/^m-(\d+)$/);
    if (idMatch?.[1]) {
      const numeric = String(Number.parseInt(idMatch[1], 10));
      keys.add(numeric);
      keys.add(`m-${numeric}`);
    }

    return keys;
  }

  private sanitizeMilestoneTitle(title: string): string {
    const sanitized = title
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 50);
    return sanitized || 'milestone';
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
   * Update checklist content (AC or DoD) in the markdown body
   */
  private updateChecklistInBody(
    body: string,
    listType: 'acceptanceCriteria' | 'definitionOfDone',
    newContent: string
  ): string {
    const isAC = listType === 'acceptanceCriteria';
    const beginMarker = isAC ? '<!-- AC:BEGIN -->' : '<!-- DOD:BEGIN -->';
    const endMarker = isAC ? '<!-- AC:END -->' : '<!-- DOD:END -->';
    const sectionHeader = isAC ? '## Acceptance Criteria' : '## Definition of Done';

    const beginIndex = body.indexOf(beginMarker);
    const endIndex = body.indexOf(endMarker);

    if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
      // Replace content between markers
      const before = body.substring(0, beginIndex + beginMarker.length);
      const after = body.substring(endIndex);
      return `${before}\n${newContent}\n${after}`;
    }

    // No markers found — look for section header and add markers
    const headerRegex = new RegExp(
      `^${sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'm'
    );
    const match = body.match(headerRegex);

    if (match && match.index !== undefined) {
      const afterHeader = body.substring(match.index + match[0].length);
      const nextSectionMatch = afterHeader.match(/^## /m);
      const nextSectionIndex = nextSectionMatch?.index ?? afterHeader.length;

      const before = body.substring(0, match.index + match[0].length);
      const after = body.substring(match.index + match[0].length + nextSectionIndex);

      return `${before}\n${beginMarker}\n${newContent}\n${endMarker}\n${after}`;
    }

    // No section header — append new section
    return `${body}\n${sectionHeader}\n${beginMarker}\n${newContent}\n${endMarker}\n`;
  }

  private static readonly STRUCTURED_SECTIONS: Record<
    string,
    { title: string; markerId: string; headerVariants: RegExp }
  > = {
    implementationPlan: {
      title: 'Implementation Plan',
      markerId: 'PLAN',
      headerVariants: /^## (?:Implementation )?Plan\s*$/m,
    },
    implementationNotes: {
      title: 'Implementation Notes',
      markerId: 'NOTES',
      headerVariants: /^## (?:Implementation )?Notes\s*$/m,
    },
    finalSummary: {
      title: 'Final Summary',
      markerId: 'FINAL_SUMMARY',
      headerVariants: /^## (?:Final )?Summary\s*$/m,
    },
  };

  /**
   * Update a structured section (Implementation Plan, Notes, Final Summary) in the markdown body.
   * Uses the same 3-tier fallback as updateDescriptionInBody:
   *  1. Markers exist → replace between them
   *  2. Header exists but no markers → add markers around existing content
   *  3. Nothing exists → append new section
   */
  private updateStructuredSectionInBody(
    body: string,
    sectionKey: string,
    newContent: string
  ): string {
    const config = BacklogWriter.STRUCTURED_SECTIONS[sectionKey];
    if (!config) return body;

    const beginMarker = `<!-- SECTION:${config.markerId}:BEGIN -->`;
    const endMarker = `<!-- SECTION:${config.markerId}:END -->`;

    const beginIndex = body.indexOf(beginMarker);
    const endIndex = body.indexOf(endMarker);

    if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
      // Tier 1: Replace content between markers
      const before = body.substring(0, beginIndex + beginMarker.length);
      const after = body.substring(endIndex);
      return `${before}\n${newContent}\n${after}`;
    }

    // Tier 2: Header exists but no markers
    const match = body.match(config.headerVariants);
    if (match && match.index !== undefined) {
      const afterHeader = body.substring(match.index + match[0].length);
      const nextSectionMatch = afterHeader.match(/^## /m);
      const nextSectionIndex = nextSectionMatch?.index ?? afterHeader.length;

      const before = body.substring(0, match.index + match[0].length);
      const after = body.substring(match.index + match[0].length + nextSectionIndex);

      return `${before}\n\n${beginMarker}\n${newContent}\n${endMarker}\n${after}`;
    }

    // Tier 3: Nothing exists — append new section
    return `${body}\n## ${config.title}\n\n${beginMarker}\n${newContent}\n${endMarker}\n`;
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

    const rawContent = fs.readFileSync(task.filePath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    let content = normalizeToLF(rawContent);

    // Find and toggle the specific checklist item by its #id
    // This is in the markdown body, not YAML, so regex is appropriate here
    const regex = new RegExp(`^(- \\[)([ xX])(\\]\\s*#${itemId}\\s+.*)$`, 'gm');
    content = content.replace(regex, (_match, prefix, check, suffix) => {
      const newCheck = check === ' ' ? 'x' : ' ';
      return `${prefix}${newCheck}${suffix}`;
    });

    fs.writeFileSync(task.filePath, restoreLineEndings(content, hasCRLF), 'utf-8');
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
  /**
   * Get the next available document ID number
   */
  private getNextDocId(docsDir: string): number {
    if (!fs.existsSync(docsDir)) return 1;
    const files = this.getMarkdownFilesRecursive(docsDir);
    let maxId = 0;
    for (const file of files) {
      const match = path.basename(file).match(/^doc-(\d+)/i);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > maxId) maxId = id;
      }
    }
    return maxId + 1;
  }

  /**
   * Get the next available decision ID number
   */
  private getNextDecisionId(decisionsDir: string): number {
    if (!fs.existsSync(decisionsDir)) return 1;
    const files = fs.readdirSync(decisionsDir).filter((f) => f.endsWith('.md'));
    let maxId = 0;
    for (const file of files) {
      const match = file.match(/^decision-(\d+)/i);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > maxId) maxId = id;
      }
    }
    return maxId + 1;
  }

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
   * Create a new document in backlog/docs/
   */
  async createDocument(
    backlogPath: string,
    title: string,
    options?: { type?: string; tags?: string[]; content?: string }
  ): Promise<{ id: string; filePath: string }> {
    const docsDir = path.join(backlogPath, 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const nextId = this.getNextDocId(docsDir);
    const paddedId = String(nextId).padStart(3, '0');
    const docId = `doc-${paddedId}`;

    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const fileName = `${docId} - ${sanitizedTitle}.md`;
    const filePath = path.join(docsDir, fileName);

    const today = new Date().toISOString().split('T')[0];
    const frontmatter: FrontmatterData = {
      id: docId.toUpperCase(),
      title,
      type: options?.type || 'other',
      created_date: today,
      updated_date: today,
    };
    if (options?.tags && options.tags.length > 0) {
      frontmatter['tags'] = options.tags;
    }

    const body = `\n${options?.content || ''}\n`;
    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id: docId.toUpperCase(), filePath };
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    docId: string,
    updates: { title?: string; content?: string; type?: string; tags?: string[] },
    parser: BacklogParser
  ): Promise<void> {
    const doc = await parser.getDocument(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    const rawContent = fs.readFileSync(doc.filePath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);
    const { frontmatter, body } = this.extractFrontmatter(content);

    if (updates.title !== undefined) frontmatter.title = updates.title;
    if (updates.type !== undefined) frontmatter.type = updates.type;
    if (updates.tags !== undefined) frontmatter['tags'] = updates.tags;
    frontmatter.updated_date = new Date().toISOString().split('T')[0];

    const updatedBody = updates.content !== undefined ? `\n${updates.content}\n` : body;
    const updatedContent = restoreLineEndings(
      this.reconstructFile(frontmatter, updatedBody),
      hasCRLF
    );
    fs.writeFileSync(doc.filePath, updatedContent, 'utf-8');
  }

  /**
   * Delete a document
   */
  async deleteDocument(docId: string, parser: BacklogParser): Promise<void> {
    const doc = await parser.getDocument(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }
    fs.unlinkSync(doc.filePath);
  }

  /**
   * Create a new decision in backlog/decisions/
   */
  async createDecision(
    backlogPath: string,
    title: string,
    options?: {
      status?: string;
      context?: string;
      decision?: string;
      consequences?: string;
      alternatives?: string;
    }
  ): Promise<{ id: string; filePath: string }> {
    const decisionsDir = path.join(backlogPath, 'decisions');
    if (!fs.existsSync(decisionsDir)) {
      fs.mkdirSync(decisionsDir, { recursive: true });
    }

    const nextId = this.getNextDecisionId(decisionsDir);
    const paddedId = String(nextId).padStart(3, '0');
    const decisionId = `decision-${paddedId}`;

    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const fileName = `${decisionId} - ${sanitizedTitle}.md`;
    const filePath = path.join(decisionsDir, fileName);

    const today = new Date().toISOString().split('T')[0];
    const frontmatter: FrontmatterData = {
      id: decisionId.toUpperCase(),
      title,
      ['date']: today,
      status: options?.status || 'proposed',
    };

    let body = '';
    body += `\n## Context\n\n${options?.context || ''}\n`;
    body += `\n## Decision\n\n${options?.decision || ''}\n`;
    body += `\n## Consequences\n\n${options?.consequences || ''}\n`;
    body += `\n## Alternatives\n\n${options?.alternatives || ''}\n`;

    const content = this.reconstructFile(frontmatter, body);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { id: decisionId.toUpperCase(), filePath };
  }

  /**
   * Update an existing decision
   */
  async updateDecision(
    decisionId: string,
    updates: {
      title?: string;
      status?: string;
      context?: string;
      decision?: string;
      consequences?: string;
      alternatives?: string;
    },
    parser: BacklogParser
  ): Promise<void> {
    const dec = await parser.getDecision(decisionId);
    if (!dec) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    const rawContent = fs.readFileSync(dec.filePath, 'utf-8');
    const hasCRLF = detectCRLF(rawContent);
    const content = normalizeToLF(rawContent);
    const { frontmatter, body } = this.extractFrontmatter(content);

    if (updates.title !== undefined) frontmatter.title = updates.title;
    if (updates.status !== undefined) frontmatter.status = updates.status;

    // Update sections in body
    let updatedBody = body;
    const sections: Record<string, string | undefined> = {
      Context: updates.context,
      Decision: updates.decision,
      Consequences: updates.consequences,
      Alternatives: updates.alternatives,
    };

    for (const [sectionName, sectionContent] of Object.entries(sections)) {
      if (sectionContent === undefined) continue;
      const sectionRegex = new RegExp(
        `(## ${sectionName}\\n\\n)[\\s\\S]*?(?=\\n## |$)`,
        'g'
      );
      if (sectionRegex.test(updatedBody)) {
        updatedBody = updatedBody.replace(
          new RegExp(`(## ${sectionName}\\n\\n)[\\s\\S]*?(?=\\n## |$)`),
          `$1${sectionContent}\n`
        );
      } else {
        updatedBody += `\n## ${sectionName}\n\n${sectionContent}\n`;
      }
    }

    const updatedContent = restoreLineEndings(
      this.reconstructFile(frontmatter, updatedBody),
      hasCRLF
    );
    fs.writeFileSync(dec.filePath, updatedContent, 'utf-8');
  }

  /**
   * Delete a decision
   */
  async deleteDecision(decisionId: string, parser: BacklogParser): Promise<void> {
    const dec = await parser.getDecision(decisionId);
    if (!dec) {
      throw new Error(`Decision ${decisionId} not found`);
    }
    fs.unlinkSync(dec.filePath);
  }

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
