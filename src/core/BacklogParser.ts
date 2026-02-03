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
      while (lineIndex < lines.length && lines[lineIndex]?.trim() !== '---') {
        const line = lines[lineIndex].trim();
        this.parseFrontmatterLine(line, task, lines, lineIndex);
        lineIndex++;
      }
      lineIndex++; // Skip closing ---
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
   * Parse a single line from YAML frontmatter
   */
  private parseFrontmatterLine(
    line: string,
    task: Task,
    allLines: string[],
    currentIndex: number
  ): void {
    // Handle key: value pairs
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim().toLowerCase();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes from values
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'id':
        task.id = value.toUpperCase();
        break;
      case 'title':
        task.title = value;
        break;
      case 'status':
        task.status = this.parseStatus(value);
        break;
      case 'priority':
        task.priority = this.parsePriority(value);
        break;
      case 'milestone':
        task.milestone = value || undefined;
        break;
      case 'labels':
        // Labels can be inline array or multi-line
        if (value.startsWith('[')) {
          // Inline array: labels: [a, b, c]
          task.labels = this.parseInlineArray(value);
        } else if (value === '') {
          // Multi-line array - look at next lines
          task.labels = this.parseMultiLineArray(allLines, currentIndex);
        }
        break;
      case 'assignee':
      case 'assignees':
        if (value.startsWith('[')) {
          task.assignee = this.parseInlineArray(value);
        } else if (value === '') {
          task.assignee = this.parseMultiLineArray(allLines, currentIndex);
        } else if (value) {
          task.assignee = [value];
        }
        break;
      case 'dependencies':
        if (value.startsWith('[')) {
          task.dependencies = this.parseInlineArray(value);
        } else if (value === '') {
          task.dependencies = this.parseMultiLineArray(allLines, currentIndex);
        }
        break;
      case 'created_date':
      case 'created':
        task.createdAt = value;
        break;
      case 'updated_date':
      case 'updated':
        task.updatedAt = value;
        break;
    }
  }

  /**
   * Parse inline YAML array like [a, b, c]
   */
  private parseInlineArray(value: string): string[] {
    const inner = value.slice(1, -1); // Remove [ ]
    if (!inner.trim()) return [];
    return inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }

  /**
   * Parse multi-line YAML array (lines starting with -)
   */
  private parseMultiLineArray(lines: string[], startIndex: number): string[] {
    const result: string[] = [];
    let i = startIndex + 1;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith('- ')) {
        let value = line.substring(2).trim();
        // Remove quotes
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        result.push(value);
        i++;
      } else if (line === '---' || (line && !line.startsWith(' ') && !line.startsWith('-'))) {
        // End of array - hit another key or end of frontmatter
        break;
      } else {
        i++;
      }
    }

    return result;
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
