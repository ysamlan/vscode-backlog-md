import * as fs from 'fs';
import * as path from 'path';

export interface InitBacklogOptions {
  projectName: string;
  taskPrefix: string;
  statuses: string[];
  // Advanced options (all optional — omitted fields use upstream defaults)
  checkActiveBranches?: boolean;
  remoteOperations?: boolean;
  activeBranchDays?: number;
  bypassGitHooks?: boolean;
  autoCommit?: boolean;
  zeroPaddedIds?: number;
  defaultEditor?: string;
  defaultPort?: number;
  autoOpenBrowser?: boolean;
}

const TASK_PREFIX_PATTERN = /^[a-zA-Z]+$/;

export function validateTaskPrefix(prefix: string): boolean {
  return TASK_PREFIX_PATTERN.test(prefix);
}

export function generateConfigYml(options: InitBacklogOptions): string {
  const esc = (s: string) => s.replace(/"/g, '\\"');
  const statusList = options.statuses.map((s) => `"${esc(s)}"`).join(', ');
  const defaultStatus = esc(options.statuses[0] ?? 'To Do');

  // Field order and format matches upstream serializeConfig() for cross-tool consistency
  const lines: string[] = [
    `project_name: "${esc(options.projectName)}"`,
    `default_status: "${defaultStatus}"`,
    `statuses: [${statusList}]`,
    `labels: []`,
    `milestones: []`,
    `date_format: yyyy-mm-dd`,
    `max_column_width: 20`,
  ];

  // Advanced fields — only written when explicitly set (matching upstream conditional output)
  if (options.defaultEditor) {
    lines.push(`default_editor: "${esc(options.defaultEditor)}"`);
  }
  if (typeof options.autoOpenBrowser === 'boolean') {
    lines.push(`auto_open_browser: ${options.autoOpenBrowser}`);
  }
  if (typeof options.defaultPort === 'number') {
    lines.push(`default_port: ${options.defaultPort}`);
  }
  if (typeof options.remoteOperations === 'boolean') {
    lines.push(`remote_operations: ${options.remoteOperations}`);
  }
  if (typeof options.autoCommit === 'boolean') {
    lines.push(`auto_commit: ${options.autoCommit}`);
  }
  if (typeof options.zeroPaddedIds === 'number') {
    lines.push(`zero_padded_ids: ${options.zeroPaddedIds}`);
  }
  if (typeof options.bypassGitHooks === 'boolean') {
    lines.push(`bypass_git_hooks: ${options.bypassGitHooks}`);
  }
  if (typeof options.checkActiveBranches === 'boolean') {
    lines.push(`check_active_branches: ${options.checkActiveBranches}`);
  }
  if (typeof options.activeBranchDays === 'number') {
    lines.push(`active_branch_days: ${options.activeBranchDays}`);
  }

  // task_prefix always last (matches upstream)
  lines.push(`task_prefix: "${options.taskPrefix}"`);
  lines.push('');

  return lines.join('\n');
}

const DIRECTORIES = [
  'tasks',
  'drafts',
  'completed',
  path.join('archive', 'tasks'),
  path.join('archive', 'drafts'),
  path.join('archive', 'milestones'),
  'docs',
  'decisions',
  'milestones',
];

export function initializeBacklog(workspaceRoot: string, options: InitBacklogOptions): string {
  if (!validateTaskPrefix(options.taskPrefix)) {
    throw new Error(
      `Invalid task prefix "${options.taskPrefix}": must contain only letters (a-z, A-Z)`
    );
  }

  const backlogPath = path.join(workspaceRoot, 'backlog');

  if (fs.existsSync(backlogPath)) {
    throw new Error(`Backlog folder already exists at ${backlogPath}`);
  }

  // Create all directories
  for (const dir of DIRECTORIES) {
    fs.mkdirSync(path.join(backlogPath, dir), { recursive: true });
  }

  // Write config.yml
  const configContent = generateConfigYml(options);
  fs.writeFileSync(path.join(backlogPath, 'config.yml'), configContent, 'utf-8');

  return backlogPath;
}
