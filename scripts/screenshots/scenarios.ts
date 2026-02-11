/**
 * Screenshot scenario definitions
 *
 * Each scenario describes a specific UI state to capture for README screenshots.
 * Scenarios define the navigation commands needed to reach the desired state
 * and are executed sequentially within each theme.
 */

export interface ScreenshotScenario {
  /** Unique name used for the output filename (e.g., "kanban") */
  name: string;
  /** Human-readable description for logging */
  description: string;
  /** Target sidebar width in logical pixels (at 1x). Default: 380 */
  sidebarWidth?: number;
  /** Crop to a specific panel instead of capturing full window. undefined = full window */
  crop?: 'sidebar' | 'editor';
  /** Chrome style: 'window' = macOS title bar + shadow, 'panel' = rounded corners + shadow only. Default: 'window' */
  chrome?: 'window' | 'panel';
  /** Ordered list of steps to reach the desired UI state */
  steps: ScenarioStep[];
}

export type ScenarioStep =
  | { type: 'command'; command: string }
  | { type: 'wait'; ms: number }
  | { type: 'quickOpen'; filename: string }
  | { type: 'keyboard'; key: string }
  | { type: 'selectTask'; text: string }
  | { type: 'collapseDetails' }
  | { type: 'expandDetails' }
  | { type: 'clickWebviewButton'; text: string };

/**
 * 3 screenshot scenarios for README images.
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
    name: 'kanban',
    description: 'Kanban board with task cards in multiple columns',
    crop: 'sidebar',
    chrome: 'panel',
    sidebarWidth: 700,
    steps: [
      { type: 'command', command: 'Backlog: Open Kanban Board' },
      { type: 'wait', ms: 2000 },
      // Collapse the DETAILS panel so the kanban board fills the full sidebar height
      { type: 'collapseDetails' },
      { type: 'wait', ms: 500 },
    ],
  },
  {
    name: 'list-detail',
    description: 'List view with task detail in sidebar preview',
    crop: 'sidebar',
    chrome: 'panel',
    sidebarWidth: 500,
    steps: [
      { type: 'command', command: 'Switch to List View' },
      { type: 'wait', ms: 3000 },
      // Select a task with rich content to populate the sidebar preview panel
      { type: 'selectTask', text: 'Implement user authentication' },
      { type: 'wait', ms: 2000 },
      // Expand the DETAILS panel so the task preview is prominently visible
      { type: 'expandDetails' },
      { type: 'wait', ms: 500 },
    ],
  },
  {
    name: 'edit',
    description: 'Task detail editor with rich content',
    crop: 'editor',
    chrome: 'panel',
    sidebarWidth: 420,
    steps: [
      { type: 'command', command: 'Switch to List View' },
      { type: 'wait', ms: 3000 },
      // Select a task to populate the sidebar preview
      { type: 'selectTask', text: 'Refactor database layer' },
      { type: 'wait', ms: 2000 },
      // Click "Edit" button in the sidebar preview to open full task detail in editor
      { type: 'clickWebviewButton', text: 'Edit' },
      { type: 'wait', ms: 2000 },
    ],
  },
];

/**
 * Theme configurations for screenshot generation.
 * Both themes are built-in to VS Code — no extension installation needed.
 */
export const themes = [
  {
    id: 'dark',
    name: 'Default Dark Modern',
    setting: 'Default Dark Modern',
  },
  {
    id: 'light',
    name: 'Quiet Light',
    setting: 'Quiet Light',
  },
] as const;

export type ThemeId = (typeof themes)[number]['id'];
