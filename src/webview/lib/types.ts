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
