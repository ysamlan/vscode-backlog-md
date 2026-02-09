# Backlog.md for VS Code

[![VS Code 1.108+](https://img.shields.io/badge/VS%20Code-1.108%2B-blue.svg)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension for browsing and managing [Backlog.md](https://github.com/backlog-md/backlog) tasks directly in your editor. Backlog.md is human-friendly and machine-accessible tool for managing a project task list and backlog in Markdown format.

![Kanban Board](docs/images/kanban-board.png)

![Task List](docs/images/task-list.png)

## Features

- **Kanban Board** — Drag-and-drop tasks between status columns (Draft, To Do, In Progress, Done)
- **Task List** — Sortable, filterable table view with search and column customization
- **Task Detail** — Rich view with inline editing for title, description, priority, status, assignees, and labels
- **Real-time Sync** — File watcher automatically syncs changes from disk
- **Theme Support** — Works with Light, Dark, and High Contrast themes
- **Editor Intelligence** — Autocomplete, clickable links, and hover info for raw Markdown task files (see below)

<details>
<summary>More screenshots</summary>

![Task List](docs/images/task-list.png)
![Task Detail](docs/images/task-detail.png)

</details>

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Backlog.md"
4. Click Install

### From VSIX File

1. Download the `.vsix` file from [Releases](https://github.com/ysamlan/vscode-backlog-md/releases)
2. In VS Code, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded file

## Getting Started

1. Install [backlog.md](https://backlog.md/)
2. Run `backlog init` to set up the folder structure
3. Click the **Backlog** icon in the Activity Bar to view your tasks

The extension activates automatically when it detects a project set up by Backlog.md (`backlog/config.yml` or `backlog/tasks/*.md`).

## Editor Intelligence

When you open a raw backlog task file (e.g., via "Open Raw Markdown" or by opening a `.md` file inside `backlog/tasks/`), the extension provides smart editor features on top of the normal Markdown editing experience:

- **Frontmatter autocomplete** — Context-aware suggestions when editing `status:`, `priority:`, `milestone:`, `labels:`, `assignee:`, and `dependencies:` fields. Values come from your `config.yml` and existing tasks.
- **Task ID autocomplete** — Type a task prefix (e.g., `TASK-`) anywhere in the body or in `dependencies:` to see suggestions of all known task IDs with their titles.
- **Clickable task links** — Task IDs like `TASK-42` in the document body become clickable links that open the referenced task's detail view.
- **Hover info** — Hover over any task ID to see a tooltip with the task's title, status, priority, milestone, labels, and a description preview.

## Keyboard Shortcuts

Press `?` in the tasks view to see all shortcuts, or use the `?` button in the bottom-right corner.

| Key       | Action                          |
| --------- | ------------------------------- |
| `?`       | Show keyboard shortcuts         |
| `z`       | Kanban view                     |
| `x`       | List view                       |
| `c`       | Drafts view                     |
| `v`       | Archived view                   |
| `j` / `k` | Next / previous task            |
| `h` / `l` | Previous / next column (kanban) |
| `Enter`   | Open focused task               |
| `/`       | Focus search                    |
| `n`       | Create new task                 |
| `r`       | Refresh views                   |
| `Esc`     | Close popup                     |

## Commands

Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and type "Backlog":

| Command                        | Description                 |
| ------------------------------ | --------------------------- |
| **Backlog: Open Kanban Board** | Open the Kanban board view  |
| **Backlog: Open Task List**    | Open the task list view     |
| **Backlog: Open Dashboard**    | Open the dashboard overview |
| **Backlog: Create Task**       | Create a new task file      |
| **Backlog: Refresh**           | Refresh tasks from disk     |

## Settings

Configure extension settings in VS Code Settings (`Ctrl+,` / `Cmd+,`), then search for `Backlog`.

### Task ID Display

Use `backlog.taskIdDisplay` to control how task IDs appear in card and list views:

- `full` (default): `TASK-123`
- `number`: `123` (or `2.1` for subtask IDs like `TASK-2.1`)
- `hidden`: do not show task IDs

You can also set it in `settings.json`:

```json
{
  "backlog.taskIdDisplay": "full"
}
```

## Requirements

- VS Code 1.108.0 or later
- A workspace containing a `backlog/` folder set up through Backlog.md's `backlog init`

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) for development setup and guidelines before submitting a pull request.

## License

MIT — see [LICENSE](LICENSE) for details.
