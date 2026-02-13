/**
 * Tab modes for the unified Tasks view
 */
export type TabMode =
  | 'kanban'
  | 'list'
  | 'drafts'
  | 'archived'
  | 'dashboard'
  | 'docs'
  | 'decisions';

/**
 * Re-export core types for use in webview components
 *
 * This provides a clean import path for webview code to access
 * the shared type definitions without reaching into src/core.
 */
export type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskIdDisplayMode,
  TaskSource,
  TaskFolder,
  TasksViewSettings,
  ChecklistItem,
  Milestone,
  BacklogConfig,
  BacklogDocument,
  BacklogDecision,
  DecisionStatus,
  DocumentType,
  WebviewMessage,
  ExtensionMessage,
  DataSourceMode,
} from '../../core/types';
export { isReadOnlyTask, getReadOnlyTaskContext } from '../../core/types';

/**
 * Dashboard statistics data structure
 */
export interface DashboardStats {
  totalTasks: number;
  completedCount: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  milestones: MilestoneStats[];
}

export interface MilestoneStats {
  name: string;
  total: number;
  done: number;
}

/**
 * Task detail view data sent from extension
 */
export interface TaskDetailData {
  task: import('../../core/types').Task;
  statuses: string[];
  priorities: string[];
  uniqueLabels: string[];
  uniqueAssignees: string[];
  milestones: string[];
  blocksTaskIds: string[];
  linkableTasks: Array<{ id: string; title: string; status: string }>;
  isBlocked: boolean;
  missingDependencyIds?: string[];
  descriptionHtml: string;
  isDraft?: boolean;
  isArchived?: boolean;
  isReadOnly?: boolean;
  readOnlyReason?: string;
  parentTask?: { id: string; title: string };
  subtaskSummaries?: Array<{ id: string; title: string; status: string }>;
}
