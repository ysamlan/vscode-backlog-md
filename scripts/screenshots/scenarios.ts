/**
 * Screenshot scenario definitions
 *
 * Each scenario describes a specific UI state to capture for README screenshots.
 * Scenarios define the navigation commands needed to reach the desired state
 * and are executed sequentially within each theme.
 */

export interface ScreenshotScenario {
  /** Unique name used for the output filename (e.g., "kanban-plus-edit") */
  name: string;
  /** Human-readable description for logging */
  description: string;
  /** Target sidebar width in logical pixels (at 1x). Default: 380 */
  sidebarWidth?: number;
  /** Ordered list of steps to reach the desired UI state */
  steps: ScenarioStep[];
}

export type ScenarioStep =
  | { type: 'command'; command: string }
  | { type: 'wait'; ms: number }
  | { type: 'quickOpen'; filename: string }
  | { type: 'keyboard'; key: string }
  | { type: 'selectTask'; text: string };

/**
 * All 5 screenshot scenarios matching the existing README images.
 *
 * Steps use command palette commands, Quick Open, keyboard shortcuts,
 * and webview target injection (for task selection within sidebar webviews).
 *
 * Command names must be specific enough to uniquely match in the command palette.
 * Use "Switch to List View" / "Switch to Kanban View" for view toggling (more reliable
 * than "Backlog: Open Task List" which can fuzzy-match to "Backlog: Open Task Detail").
 */
export const scenarios: ScreenshotScenario[] = [
  {
    name: 'kanban-plus-edit',
    description: 'Kanban board with task detail editor open',
    sidebarWidth: 420,
    steps: [
      { type: 'command', command: 'Backlog: Open Kanban Board' },
      { type: 'wait', ms: 2000 },
      // Select a task (populates sidebar preview with task details)
      { type: 'selectTask', text: 'Implement user authentication' },
      { type: 'wait', ms: 1000 },
      // Open the task markdown file in the editor area
      { type: 'quickOpen', filename: 'TASK-2 - Implement' },
      { type: 'wait', ms: 1000 },
    ],
  },
  {
    name: 'list-plus-details',
    description: 'List view with task preview panel',
    sidebarWidth: 500,
    steps: [
      // Use "Switch to" commands which are more unique in the command palette
      { type: 'command', command: 'Switch to List View' },
      { type: 'wait', ms: 3000 },
      // Select a visible task to populate the sidebar preview panel
      { type: 'selectTask', text: 'Add dark mode support' },
      { type: 'wait', ms: 1000 },
    ],
  },
  {
    name: 'dashboard-plus-add-new',
    description: 'Dashboard tab with create new task panel',
    sidebarWidth: 380,
    steps: [
      { type: 'command', command: 'Backlog: Open Dashboard' },
      { type: 'wait', ms: 3000 },
      // Open create task panel in editor area
      { type: 'command', command: 'Backlog: Create Task' },
      { type: 'wait', ms: 2000 },
    ],
  },
  {
    name: 'list-plus-markdown',
    description: 'List view with raw markdown file in editor',
    sidebarWidth: 420,
    steps: [
      { type: 'command', command: 'Switch to List View' },
      { type: 'wait', ms: 3000 },
      // Open a task markdown file in the editor area
      { type: 'quickOpen', filename: 'TASK-2 - Implement' },
      { type: 'wait', ms: 2000 },
    ],
  },
  {
    name: 'list-plus-details-plus-add-new',
    description: 'List view with preview panel and create new task',
    sidebarWidth: 380,
    steps: [
      { type: 'command', command: 'Switch to List View' },
      { type: 'wait', ms: 3000 },
      // Select a task to show preview
      { type: 'selectTask', text: 'Fix login redirect bug' },
      { type: 'wait', ms: 1000 },
      // Open create task panel
      { type: 'command', command: 'Backlog: Create Task' },
      { type: 'wait', ms: 1500 },
    ],
  },
];

/** Theme configurations for screenshot generation */
export const themes = [
  {
    id: 'dark',
    name: 'Default Dark+',
    setting: 'Default Dark+',
  },
  {
    id: 'light',
    name: 'Default Light+',
    setting: 'Default Light+',
  },
] as const;

export type ThemeId = (typeof themes)[number]['id'];
