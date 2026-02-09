import * as vscode from 'vscode';
import type { BacklogParser } from '../core/BacklogParser';

/** Pattern matching task IDs like TASK-1, TASK-001, TASK-5.1 */
const TASK_ID_PATTERN = /\b([A-Z]+-\d+(?:\.\d+)*)\b/g;

/**
 * Provides clickable links for task ID references in backlog task files.
 * Each recognized task ID becomes a link that opens the task detail view.
 */
export class BacklogDocumentLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private parser: BacklogParser) {}

  async provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    // Get the current document's own task ID to exclude self-links
    const selfId = this.extractSelfId(document);

    // Build a set of known task IDs for fast lookup
    const knownIds = new Set<string>();
    const folders = ['tasks', 'drafts', 'completed', 'archive/tasks'] as const;
    for (const folder of folders) {
      const tasks = await this.parser.getTasksFromFolder(folder);
      for (const task of tasks) {
        knownIds.add(task.id);
      }
    }

    const links: vscode.DocumentLink[] = [];

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const lineText = document.lineAt(lineNum).text;
      let match: RegExpExecArray | null;
      TASK_ID_PATTERN.lastIndex = 0;

      while ((match = TASK_ID_PATTERN.exec(lineText)) !== null) {
        const taskId = match[1];
        if (taskId === selfId) continue;
        if (!knownIds.has(taskId)) continue;

        const startPos = new vscode.Position(lineNum, match.index);
        const endPos = new vscode.Position(lineNum, match.index + taskId.length);
        const range = new vscode.Range(startPos, endPos);

        const commandUri = vscode.Uri.parse(
          `command:backlog.openTaskDetail?${encodeURIComponent(JSON.stringify(taskId))}`
        );
        const link = new vscode.DocumentLink(range, commandUri);
        link.tooltip = `Open ${taskId}`;
        links.push(link);
      }
    }

    return links;
  }

  /**
   * Extract the task ID from the document's own frontmatter or filename.
   */
  private extractSelfId(document: vscode.TextDocument): string | undefined {
    // Try frontmatter
    if (document.lineCount > 1 && document.lineAt(0).text.trim() === '---') {
      for (let i = 1; i < document.lineCount; i++) {
        const line = document.lineAt(i).text.trim();
        if (line === '---') break;
        const idMatch = line.match(/^id:\s*(.+)/);
        if (idMatch) return idMatch[1].trim().toUpperCase();
      }
    }
    // Fall back to filename
    const fileName = document.uri.fsPath.split('/').pop()?.replace('.md', '') || '';
    const fnMatch = fileName.match(/^([a-zA-Z]+-\d+(?:\.\d+)*)/i);
    return fnMatch ? fnMatch[1].toUpperCase() : undefined;
  }
}
