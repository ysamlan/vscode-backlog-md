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
  TaskSource,
  ChecklistItem,
  Milestone,
  BacklogConfig,
  WebviewMessage,
  ExtensionMessage,
  DataSourceMode,
} from '../../core/types';

/**
 * Dashboard statistics data structure
 */
export interface DashboardStats {
  totalTasks: number;
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
  isBlocked: boolean;
  descriptionHtml: string;
}
