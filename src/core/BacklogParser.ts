import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskStatus, TaskPriority, ChecklistItem, Milestone } from './types';

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

    if (!fs.existsSync(tasksPath)) {
      return [];
    }

    const files = fs.readdirSync(tasksPath).filter((f) => f.endsWith('.md'));
    const tasks: Task[] = [];

    for (const file of files) {
      const filePath = path.join(tasksPath, file);
      try {
        const task = await this.parseTaskFile(filePath);
        if (task) {
          tasks.push(task);
        }
      } catch (error) {
        console.error(`Error parsing task file ${file}:`, error);
      }
    }

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
   * Parse task content from markdown
   */
  parseTaskContent(content: string, filePath: string): Task | undefined {
    const lines = content.split('\n');

    // Extract ID from filename or content
    const filename = path.basename(filePath, '.md');
    const idMatch = filename.match(/^(task-\d+)/i);
    const id = idMatch ? idMatch[1].toUpperCase() : filename;

    // Parse frontmatter-style metadata
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

    let currentSection = '';
    const descriptionLines: string[] = [];
    const notesLines: string[] = [];
    const summaryLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Parse title from first heading
      if (trimmedLine.startsWith('# ') && !task.title) {
        // Title format: "# TASK-1 - Title Here" or just "# Title Here"
        const titleMatch = trimmedLine.match(/^#\s+(?:TASK-\d+\s*-\s*)?(.+)$/i);
        if (titleMatch) {
          task.title = titleMatch[1].trim();
        }
        continue;
      }

      // Parse metadata lines
      if (trimmedLine.startsWith('Status:')) {
        task.status = this.parseStatus(trimmedLine.substring(7).trim());
        continue;
      }

      if (trimmedLine.startsWith('Priority:')) {
        task.priority = this.parsePriority(trimmedLine.substring(9).trim());
        continue;
      }

      if (trimmedLine.startsWith('Labels:')) {
        task.labels = this.parseList(trimmedLine.substring(7).trim());
        continue;
      }

      if (trimmedLine.startsWith('Assignee:') || trimmedLine.startsWith('Assignees:')) {
        const startIdx = trimmedLine.indexOf(':') + 1;
        task.assignee = this.parseList(trimmedLine.substring(startIdx).trim());
        continue;
      }

      if (trimmedLine.startsWith('Milestone:')) {
        task.milestone = trimmedLine.substring(10).trim() || undefined;
        continue;
      }

      if (trimmedLine.startsWith('Dependencies:')) {
        task.dependencies = this.parseList(trimmedLine.substring(13).trim());
        continue;
      }

      if (trimmedLine.startsWith('Parent:')) {
        task.parentTaskId = trimmedLine.substring(7).trim() || undefined;
        continue;
      }

      if (trimmedLine.startsWith('Created:')) {
        task.createdAt = trimmedLine.substring(8).trim();
        continue;
      }

      if (trimmedLine.startsWith('Updated:')) {
        task.updatedAt = trimmedLine.substring(8).trim();
        continue;
      }

      // Parse sections
      if (trimmedLine.startsWith('## ') || trimmedLine.match(/^[A-Za-z ]+:$/)) {
        const sectionName = trimmedLine
          .replace(/^##\s*/, '')
          .replace(/:$/, '')
          .toLowerCase();

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
      if (currentSection === 'description' && trimmedLine && !trimmedLine.startsWith('---')) {
        descriptionLines.push(line);
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
      } else if (currentSection === 'notes' && trimmedLine && !trimmedLine.startsWith('---')) {
        notesLines.push(line);
      } else if (currentSection === 'summary' && trimmedLine && !trimmedLine.startsWith('---')) {
        summaryLines.push(line);
      }
    }

    task.description = descriptionLines.join('\n').trim() || undefined;
    task.implementationNotes = notesLines.join('\n').trim() || undefined;
    task.finalSummary = summaryLines.join('\n').trim() || undefined;

    return task.title ? task : undefined;
  }

  private parseStatus(value: string): TaskStatus {
    // Handle status symbols like "○ To Do", "◒ In Progress", "● Done"
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

  private parseList(value: string): string[] {
    if (!value) return [];
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
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
