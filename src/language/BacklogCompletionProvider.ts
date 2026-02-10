import * as vscode from 'vscode';
import type { BacklogParser } from '../core/BacklogParser';
import { getFrontmatterContext } from './frontmatterContext';

/**
 * Provides autocomplete suggestions for backlog task markdown files.
 * Handles frontmatter field values (status, priority, labels, etc.)
 * and task ID references in the document body.
 */
export class BacklogCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private parser: BacklogParser) {}

  setParser(parser: BacklogParser): void {
    this.parser = parser;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionList | undefined> {
    const fmContext = getFrontmatterContext(document, position);

    if (fmContext.inFrontmatter && fmContext.fieldName) {
      return this.getFrontmatterCompletions(fmContext.fieldName);
    }

    // Body context: offer task ID completions
    return this.getTaskIdCompletions(document, position);
  }

  private async getFrontmatterCompletions(
    fieldName: string
  ): Promise<vscode.CompletionList | undefined> {
    const items: vscode.CompletionItem[] = [];

    switch (fieldName) {
      case 'status': {
        const statuses = await this.parser.getStatuses();
        for (const status of statuses) {
          const item = new vscode.CompletionItem(status, vscode.CompletionItemKind.EnumMember);
          item.detail = 'Task status';
          items.push(item);
        }
        break;
      }
      case 'priority': {
        for (const p of ['high', 'medium', 'low']) {
          const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.EnumMember);
          item.detail = 'Task priority';
          items.push(item);
        }
        break;
      }
      case 'milestone': {
        const milestones = await this.parser.getMilestones();
        for (const ms of milestones) {
          const name = typeof ms === 'string' ? ms : ms.name;
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
          item.detail = 'Milestone';
          items.push(item);
        }
        break;
      }
      case 'labels': {
        const labels = await this.parser.getUniqueLabels();
        for (const label of labels) {
          const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
          item.detail = 'Label';
          items.push(item);
        }
        break;
      }
      case 'assignee':
      case 'assignees': {
        const assignees = await this.parser.getUniqueAssignees();
        for (const assignee of assignees) {
          const item = new vscode.CompletionItem(assignee, vscode.CompletionItemKind.User);
          item.detail = 'Assignee';
          items.push(item);
        }
        break;
      }
      case 'dependencies': {
        const tasks = await this.parser.getTasks();
        for (const task of tasks) {
          const item = new vscode.CompletionItem(task.id, vscode.CompletionItemKind.Reference);
          item.detail = task.title;
          items.push(item);
        }
        break;
      }
      default:
        return undefined;
    }

    if (items.length === 0) return undefined;
    return new vscode.CompletionList(items, false);
  }

  private async getTaskIdCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionList | undefined> {
    // Check if the text before cursor looks like a task ID prefix (e.g., "TASK-")
    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // Match a partial task ID prefix: letters followed by a dash
    const prefixMatch = textBeforeCursor.match(/\b([A-Za-z]+-\d*)$/);
    if (!prefixMatch) return undefined;

    const tasks = await this.parser.getTasks();
    const items: vscode.CompletionItem[] = [];

    for (const task of tasks) {
      const item = new vscode.CompletionItem(task.id, vscode.CompletionItemKind.Reference);
      item.detail = task.title;
      item.documentation = new vscode.MarkdownString(
        `**${task.title}**\n\nStatus: ${task.status}${task.priority ? `\nPriority: ${task.priority}` : ''}`
      );
      items.push(item);
    }

    if (items.length === 0) return undefined;
    return new vscode.CompletionList(items, false);
  }
}
