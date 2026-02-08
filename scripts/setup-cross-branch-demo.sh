#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/setup-cross-branch-demo.sh [workspace_path] [--reset] [--quiet]

Creates a local git workspace with branch-divergent Backlog tasks:
- main branch: TASK-1 only
- feature/cross-branch-demo branch: TASK-1 status changed + TASK-900 branch-only task

Options:
  --reset   Remove existing workspace_path before creating it
  --quiet   Suppress summary output

Default workspace_path:
  /tmp/backlog-cross-branch-demo
EOF
}

WORKSPACE_PATH="${1:-/tmp/backlog-cross-branch-demo}"
RESET=false
QUIET=false

for arg in "$@"; do
  case "$arg" in
    --reset) RESET=true ;;
    --quiet) QUIET=true ;;
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required." >&2
  exit 1
fi

if [ -e "$WORKSPACE_PATH" ] && [ "$RESET" = true ]; then
  rm -rf "$WORKSPACE_PATH"
fi

mkdir -p "$WORKSPACE_PATH/backlog/tasks"

cat >"$WORKSPACE_PATH/backlog/config.yml" <<'EOF'
project_name: "Cross Branch Demo"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
check_active_branches: true
active_branch_days: 30
remote_operations: false
task_resolution_strategy: most_recent
task_prefix: "task"
EOF

cat >"$WORKSPACE_PATH/backlog/tasks/task-1 - Main-task.md" <<'EOF'
---
id: TASK-1
title: Main task
status: To Do
labels: [demo]
assignee: []
dependencies: []
---

## Description

Main branch task.
EOF

if [ ! -d "$WORKSPACE_PATH/.git" ]; then
  git init -b main "$WORKSPACE_PATH" >/dev/null 2>&1 || {
    git init "$WORKSPACE_PATH" >/dev/null
    git -C "$WORKSPACE_PATH" checkout -B main >/dev/null
  }
fi

git -C "$WORKSPACE_PATH" config user.email "demo@local.test"
git -C "$WORKSPACE_PATH" config user.name "Cross Branch Demo"

git -C "$WORKSPACE_PATH" add .
if ! git -C "$WORKSPACE_PATH" diff --cached --quiet; then
  git -C "$WORKSPACE_PATH" commit -m "Initialize cross-branch demo workspace" >/dev/null
fi

git -C "$WORKSPACE_PATH" checkout -B feature/cross-branch-demo >/dev/null

sed -i'' -e 's/status: To Do/status: In Progress/' "$WORKSPACE_PATH/backlog/tasks/task-1 - Main-task.md"

cat >"$WORKSPACE_PATH/backlog/tasks/task-900 - Branch-only-task.md" <<'EOF'
---
id: TASK-900
title: Branch only task
status: In Progress
labels: [demo, branch-only]
assignee: []
dependencies: []
---

## Description

This task exists only on feature/cross-branch-demo.
EOF

git -C "$WORKSPACE_PATH" add .
if ! git -C "$WORKSPACE_PATH" diff --cached --quiet; then
  git -C "$WORKSPACE_PATH" commit -m "Add branch-only demo task" >/dev/null
fi

git -C "$WORKSPACE_PATH" checkout main >/dev/null

if [ "$QUIET" = false ]; then
  cat <<EOF
Cross-branch demo ready at: $WORKSPACE_PATH

Next steps:
1. Open the folder in VS Code.
2. Start the extension host (F5) and open Backlog view.
3. Verify TASK-900 appears as read-only from feature/cross-branch-demo.
4. Verify TASK-1 is editable on main branch and differs from feature branch.
EOF
fi
