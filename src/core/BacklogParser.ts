import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Task, TaskStatus, TaskPriority, ChecklistItem, Milestone } from './types';

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
  created_date?: string;
  created?: string;
  updated_date?: string;
  updated?: string;
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
    const tasksPath = path.join(this.backlogPath, 'tasks');
    console.log(`[Backlog.md Parser] Looking for tasks in: ${tasksPath}`);

    if (!fs.existsSync(tasksPath)) {
      console.log(`[Backlog.md Parser] Tasks path does not exist: ${tasksPath}`);
      return [];
    }

    const files = fs.readdirSync(tasksPath).filter((f) => f.endsWith('.md'));
    console.log(`[Backlog.md Parser] Found ${files.length} .md files:`, files.slice(0, 5));
    const tasks: Task[] = [];

    for (const file of files) {
      const filePath = path.join(tasksPath, file);
      try {
        const task = await this.parseTaskFile(filePath);
        if (task) {
          tasks.push(task);
        }
      } catch (error) {
        console.error(`[Backlog.md Parser] Error parsing task file ${file}:`, error);
      }
    }

    console.log(`[Backlog.md Parser] Successfully parsed ${tasks.length} tasks`);
    return tasks;
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<Task | undefined> {
    const tasks = await this.getTasks();
    return tasks.find((t) => t.id === taskId);
  }

  /**
   * Get all milestones
   */
  async getMilestones(): Promise<Milestone[]> {
    const configPath = path.join(this.backlogPath, 'config.json');

    if (!fs.existsSync(configPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      return config.milestones || [];
    } catch {
      return [];
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
    const idMatch = filename.match(/^(task-\d+)/i);
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
        } else if (sectionName.includes('implementation') || sectionName.includes('notes')) {
          currentSection = 'notes';
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
      }
    }

    task.description = descriptionLines.join('\n').trim() || undefined;
    task.implementationNotes = notesLines.join('\n').trim() || undefined;
    task.finalSummary = summaryLines.join('\n').trim() || undefined;

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
    if (fm.parent) {
      task.parentTaskId = String(fm.parent);
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
