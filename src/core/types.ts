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
  parentTaskId?: string;
  filePath: string;
  createdAt?: string;
  updatedAt?: string;
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
  | { type: 'error'; message: string };
