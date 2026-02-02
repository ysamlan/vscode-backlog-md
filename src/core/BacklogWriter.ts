import * as fs from 'fs';
import { Task, TaskStatus } from './types';
import { BacklogParser } from './BacklogParser';

/**
 * Writes changes back to Backlog.md task files
 */
export class BacklogWriter {
  /**
   * Update a task's status in its file
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    parser: BacklogParser
  ): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const content = fs.readFileSync(task.filePath, 'utf-8');
    const updatedContent = this.replaceStatus(content, newStatus);

    fs.writeFileSync(task.filePath, updatedContent, 'utf-8');
  }

  /**
   * Update a task with partial changes
   */
  async updateTask(
    taskId: string,
    updates: Partial<Task>,
    parser: BacklogParser
  ): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let content = fs.readFileSync(task.filePath, 'utf-8');

    if (updates.status !== undefined) {
      content = this.replaceStatus(content, updates.status);
    }

    if (updates.priority !== undefined) {
      content = this.replacePriority(content, updates.priority);
    }

    if (updates.title !== undefined) {
      content = this.replaceTitle(content, task.id, updates.title);
    }

    fs.writeFileSync(task.filePath, content, 'utf-8');
  }

  /**
   * Toggle a checklist item
   */
  async toggleChecklistItem(
    taskId: string,
    listType: 'acceptanceCriteria' | 'definitionOfDone',
    itemId: number,
    parser: BacklogParser
  ): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let content = fs.readFileSync(task.filePath, 'utf-8');

    // Find and toggle the specific checklist item
    const regex = new RegExp(`^(- \\[)([ xX])(\\]\\s*#${itemId}\\s+.*)$`, 'gm');
    content = content.replace(regex, (match, prefix, check, suffix) => {
      const newCheck = check === ' ' ? 'x' : ' ';
      return `${prefix}${newCheck}${suffix}`;
    });

    fs.writeFileSync(task.filePath, content, 'utf-8');
  }

  private replaceStatus(content: string, newStatus: TaskStatus): string {
    // Replace status line with appropriate symbol
    const statusSymbol = this.getStatusSymbol(newStatus);
    const statusRegex = /^(Status:\s*)[○◒●◑]?\s*.*$/m;

    if (statusRegex.test(content)) {
      return content.replace(statusRegex, `$1${statusSymbol} ${newStatus}`);
    }

    // If no status line found, add one after the title
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        lines.splice(i + 1, 0, '', `Status: ${statusSymbol} ${newStatus}`);
        break;
      }
    }
    return lines.join('\n');
  }

  private replacePriority(content: string, newPriority: string | undefined): string {
    const priorityRegex = /^(Priority:\s*).*$/m;
    const capitalizedPriority = newPriority
      ? newPriority.charAt(0).toUpperCase() + newPriority.slice(1)
      : '';

    if (priorityRegex.test(content)) {
      if (newPriority) {
        return content.replace(priorityRegex, `$1${capitalizedPriority}`);
      } else {
        // Remove priority line if setting to undefined
        return content.replace(/^Priority:\s*.*\n?/m, '');
      }
    }

    // If no priority line found and we want to add one
    if (newPriority) {
      const statusRegex = /^(Status:\s*.*)$/m;
      return content.replace(statusRegex, `$1\nPriority: ${capitalizedPriority}`);
    }

    return content;
  }

  private replaceTitle(content: string, taskId: string, newTitle: string): string {
    // Replace the title in the heading
    const titleRegex = new RegExp(`^(#\\s+(?:${taskId}\\s*-\\s*)?).*$`, 'mi');
    return content.replace(titleRegex, `$1${newTitle}`);
  }

  private getStatusSymbol(status: TaskStatus): string {
    switch (status) {
      case 'To Do':
        return '○';
      case 'In Progress':
        return '◒';
      case 'Done':
        return '●';
      case 'Draft':
        return '◑';
      default:
        return '○';
    }
  }
}
