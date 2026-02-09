/**
 * Task status values matching Backlog.md format.
 * Supports arbitrary custom statuses from config.yml in addition to the built-in ones.
 */
export type TaskStatus = string;

/**
 * Task priority levels
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * A checklist item (used for acceptance criteria and definition of done)
 */
export interface ChecklistItem {
  id: number;
  text: string;
  checked: boolean;
}

/**
 * Task source indicating where the task was loaded from (cross-branch feature)
 */
export type TaskSource = 'local' | 'remote' | 'completed' | 'local-branch';

/**
 * Which folder a task lives in within the backlog directory
 */
export type TaskFolder = 'tasks' | 'drafts' | 'completed' | 'archive';

/**
 * Represents a Backlog.md task
 */
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  description?: string;
  labels: string[];
  assignee: string[];
  milestone?: string;
  dependencies: string[];
  acceptanceCriteria: ChecklistItem[];
  definitionOfDone: ChecklistItem[];
  implementationNotes?: string;
  finalSummary?: string;
  plan?: string;
  references?: string[];
  documentation?: string[];
  type?: string;
  parentTaskId?: string;
  folder?: TaskFolder;
  filePath: string;
  createdAt?: string;
  updatedAt?: string;
  ordinal?: number; // For custom ordering within status columns (fractional indexing)

  // Cross-branch fields (upstream compatibility)
  source?: TaskSource; // Where the task was loaded from
  branch?: string; // Branch the task was found on
  lastModified?: Date; // Last modification timestamp for conflict resolution
  reporter?: string; // Task reporter (upstream field)
  subtasks?: string[]; // IDs of subtask children
}

/**
 * Returns true when a task should be treated as read-only in the UI.
 * Cross-branch/remote tasks are view-only and must not allow mutations.
 */
export function isReadOnlyTask(task?: Pick<Task, 'source' | 'branch'>): boolean {
  if (!task) return false;
  return task.source === 'remote' || task.source === 'local-branch';
}

/**
 * Human-readable source context for read-only task messaging.
 */
export function getReadOnlyTaskContext(task?: Pick<Task, 'source' | 'branch'>): string {
  if (!task) return 'non-local source';
  if (task.branch) return task.branch;
  if (task.source === 'remote') return 'remote source';
  if (task.source === 'local-branch') return 'another branch';
  return 'non-local source';
}

/**
 * Represents a milestone
 */
export interface Milestone {
  id: string;
  name: string;
  description?: string;
}

/**
 * Document type for backlog docs
 */
export type DocumentType = 'readme' | 'guide' | 'specification' | 'other';

/**
 * Decision status for ADR-style decisions
 */
export type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

/**
 * Represents a Backlog.md document (from backlog/docs/)
 */
export interface BacklogDocument {
  id: string;
  title: string;
  type?: DocumentType;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  content: string;
  filePath: string;
}

/**
 * Represents a Backlog.md decision (from backlog/decisions/)
 */
export interface BacklogDecision {
  id: string;
  title: string;
  date?: string;
  status?: DecisionStatus;
  context?: string;
  decision?: string;
  consequences?: string;
  alternatives?: string;
  filePath: string;
}

/**
 * Task resolution strategy for cross-branch conflicts
 */
export type TaskResolutionStrategy = 'most_recent' | 'most_progressed';

/**
 * Backlog.md configuration from config.yml
 *
 * Field names use snake_case to match the canonical YAML format.
 * The parser normalizes camelCase variants (e.g., autoCommit -> auto_commit)
 * so both formats work in config files.
 */
export interface BacklogConfig {
  project_name?: string;
  default_status?: string;
  default_assignee?: string;
  default_reporter?: string;
  default_editor?: string;
  statuses?: string[];
  priorities?: string[];
  labels?: string[];
  milestones?: Milestone[];
  definition_of_done?: string[];
  date_format?: string;
  max_column_width?: number;
  auto_open_browser?: boolean;
  default_port?: number;
  remote_operations?: boolean;
  auto_commit?: boolean;
  bypass_git_hooks?: boolean;
  check_active_branches?: boolean;
  active_branch_days?: number;
  task_prefix?: string;
  timezone_preference?: string;
  include_date_time_in_dates?: boolean;
  on_status_change?: string;

  // Cross-branch config options (upstream compatibility)
  task_resolution_strategy?: TaskResolutionStrategy;
  zero_padded_ids?: number; // Zero-pad IDs to this width (e.g., 3 → TASK-001)
}

/**
 * Message types for webview communication
 */
export type WebviewMessage =
  | { type: 'refresh' }
  | {
      type: 'openTask';
      taskId: string;
      filePath?: string;
      source?: TaskSource;
      branch?: string;
    }
  | {
      type: 'updateTaskStatus';
      taskId: string;
      status: TaskStatus;
      ordinal?: number;
      additionalOrdinalUpdates?: Array<{ taskId: string; ordinal: number }>;
    }
  | { type: 'updateTask'; taskId: string; updates: Partial<Task> }
  | { type: 'createTask'; task: Partial<Task> }
  | { type: 'archiveTask'; taskId: string }
  | { type: 'openFile'; filePath: string }
  | { type: 'reorderTask'; taskId: string; ordinal: number }
  | { type: 'reorderTasks'; updates: Array<{ taskId: string; ordinal: number }> }
  | {
      type: 'toggleChecklistItem';
      taskId: string;
      listType: 'acceptanceCriteria' | 'definitionOfDone';
      itemId: number;
    }
  | { type: 'toggleColumnCollapse'; status: string }
  | { type: 'toggleMilestoneGrouping'; enabled: boolean }
  | { type: 'toggleMilestoneCollapse'; milestone: string }
  | { type: 'filterByStatus'; status: string }
  | { type: 'filterByLabel'; label: string }
  | { type: 'completeTask'; taskId: string }
  | { type: 'promoteDraft'; taskId: string }
  | { type: 'discardDraft'; taskId: string }
  | { type: 'requestCompletedTasks' }
  | { type: 'createSubtask'; parentTaskId: string }
  | { type: 'restoreTask'; taskId: string }
  | { type: 'deleteTask'; taskId: string }
  | {
      type: 'setViewMode';
      mode: 'kanban' | 'list' | 'drafts' | 'archived' | 'dashboard' | 'docs' | 'decisions';
    }
  | { type: 'requestCreateTask' }
  | { type: 'openDocument'; documentId: string }
  | { type: 'openDecision'; decisionId: string };

/**
 * Data source mode for task viewing
 */
export type DataSourceMode = 'local-only' | 'cross-branch';

/**
 * Message from extension to webview
 */
export type ExtensionMessage =
  | { type: 'tasksUpdated'; tasks: Task[] }
  | { type: 'taskUpdated'; task: Task }
  | { type: 'milestonesUpdated'; milestones: Milestone[] }
  | { type: 'statusesUpdated'; statuses: string[] }
  | { type: 'viewModeChanged'; viewMode: 'kanban' | 'list' }
  | { type: 'taskUpdateSuccess'; taskId: string }
  | { type: 'taskUpdateError'; taskId: string; originalStatus: TaskStatus; message: string }
  | { type: 'noBacklogFolder' }
  | { type: 'error'; message: string }
  | { type: 'dataSourceChanged'; mode: DataSourceMode; reason?: string }
  | { type: 'columnCollapseChanged'; collapsedColumns: string[] }
  | { type: 'milestoneGroupingChanged'; enabled: boolean }
  | { type: 'milestoneCollapseChanged'; collapsedMilestones: string[] }
  | { type: 'setFilter'; filter: string }
  | { type: 'setLabelFilter'; label: string }
  | { type: 'draftsModeChanged'; enabled: boolean }
  | { type: 'completedTasksUpdated'; tasks: Task[] }
  | {
      type: 'activeTabChanged';
      tab: 'kanban' | 'list' | 'drafts' | 'archived' | 'dashboard' | 'docs' | 'decisions';
    }
  | { type: 'draftCountUpdated'; count: number }
  | {
      type: 'statsUpdated';
      stats: {
        totalTasks: number;
        completedCount: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
        milestones: Array<{ name: string; total: number; done: number }>;
      };
    }
  | { type: 'configUpdated'; config: { projectName?: string } }
  | { type: 'documentsUpdated'; documents: BacklogDocument[] }
  | { type: 'decisionsUpdated'; decisions: BacklogDecision[] }
  | { type: 'documentData'; document: BacklogDocument; contentHtml: string }
  | { type: 'decisionData'; decision: BacklogDecision; sections: Record<string, string> };
