import type * as vscode from 'vscode';

/**
 * DocumentSelector that scopes language providers to backlog task files only.
 * Matches markdown files inside backlog/{tasks,drafts,completed,archive}/ directories.
 */
export const BACKLOG_DOCUMENT_SELECTOR: vscode.DocumentSelector = [
  { language: 'markdown', pattern: '**/backlog/tasks/**/*.md' },
  { language: 'markdown', pattern: '**/backlog/drafts/**/*.md' },
  { language: 'markdown', pattern: '**/backlog/completed/**/*.md' },
  { language: 'markdown', pattern: '**/backlog/archive/**/*.md' },
];
