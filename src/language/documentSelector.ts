import type * as vscode from 'vscode';

/**
 * Create a DocumentSelector that scopes language providers to backlog task files.
 * Matches markdown files inside {backlogDir}/{tasks,drafts,completed,archive}/ directories.
 */
export function createBacklogDocumentSelector(
  backlogDir: string = 'backlog'
): vscode.DocumentSelector {
  return [
    { language: 'markdown', pattern: `**/${backlogDir}/tasks/**/*.md` },
    { language: 'markdown', pattern: `**/${backlogDir}/drafts/**/*.md` },
    { language: 'markdown', pattern: `**/${backlogDir}/completed/**/*.md` },
    { language: 'markdown', pattern: `**/${backlogDir}/archive/**/*.md` },
  ];
}
