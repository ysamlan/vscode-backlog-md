import * as vscode from 'vscode';
import type { BacklogParser } from '../core/BacklogParser';

/** Pattern matching task IDs like TASK-1, TASK-001, TASK-5.1 */
const TASK_ID_PATTERN = /\b([A-Z]+-\d+(?:\.\d+)*)\b/g;

/**
 * Provides hover information for task ID references in backlog task files.
 * Shows task title, status, priority, milestone, labels, and a truncated description.
 */
export class BacklogHoverProvider implements vscode.HoverProvider {
  constructor(private parser: BacklogParser) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const wordRange = document.getWordRangeAtPosition(position, TASK_ID_PATTERN);
    if (!wordRange) return undefined;

    const taskId = document.getText(wordRange);
    const task = await this.parser.getTask(taskId);
    if (!task) return undefined;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`### ${task.id}: ${task.title}\n\n`);
    md.appendMarkdown(`**Status:** ${task.status}\n\n`);

    if (task.priority) {
      md.appendMarkdown(`**Priority:** ${task.priority}\n\n`);
    }
    if (task.milestone) {
      md.appendMarkdown(`**Milestone:** ${task.milestone}\n\n`);
    }
    if (task.labels.length > 0) {
      md.appendMarkdown(`**Labels:** ${task.labels.join(', ')}\n\n`);
    }
    if (task.description) {
      const truncated =
        task.description.length > 200
          ? task.description.substring(0, 200) + '...'
          : task.description;
      md.appendMarkdown(`---\n\n${truncated}\n`);
    }

    return new vscode.Hover(md, wordRange);
  }
}
