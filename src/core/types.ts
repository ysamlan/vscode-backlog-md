/**
 * Task status values matching Backlog.md format
 */
export type TaskStatus = 'Draft' | 'To Do' | 'In Progress' | 'Done';

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
  filePath: string;
  createdAt?: string;
  updatedAt?: string;
  ordinal?: number; // For custom ordering within status columns (fractional indexing)
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
 * Backlog.md configuration from config.yml
 */
export interface BacklogConfig {
  project_name?: string;
  default_status?: string;
  statuses?: string[];
  labels?: string[];
  milestones?: Milestone[];
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
}

/**
 * Message types for webview communication
 */
export type WebviewMessage =
  | { type: 'refresh' }
  | { type: 'openTask'; taskId: string }
  | { type: 'updateTaskStatus'; taskId: string; status: TaskStatus }
  | { type: 'updateTask'; taskId: string; updates: Partial<Task> }
  | { type: 'createTask'; task: Partial<Task> }
  | { type: 'archiveTask'; taskId: string }
  | { type: 'openFile'; filePath: string }
  | { type: 'toggleViewMode' }
  | { type: 'reorderTask'; taskId: string; ordinal: number }
  | {
      type: 'toggleChecklistItem';
      taskId: string;
      listType: 'acceptanceCriteria' | 'definitionOfDone';
      itemId: number;
    };

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
  | { type: 'error'; message: string };
