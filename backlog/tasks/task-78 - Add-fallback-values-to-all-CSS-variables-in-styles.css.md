---
id: TASK-78
title: Add fallback values to all CSS variables in styles.css
status: To Do
assignee: []
created_date: '2026-02-05 18:33'
labels:
  - bug
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CSS variables referencing VS Code theme tokens (e.g., `var(--vscode-badge-background)`) should always include fallback values so webview components render correctly in test fixtures and environments where VS Code theme variables aren't defined.

Currently `status-bar-to-do` in the dashboard Status Breakdown is invisible in test fixtures because `--vscode-badge-background` has no fallback color. Other CSS classes like `status-bar-in-progress`, `status-bar-done`, and `status-bar-draft` already have fallbacks.

Fix: audit all `var(--vscode-*)` usages in `src/webview/styles.css` and add reasonable fallback values where missing (e.g., `var(--vscode-badge-background, #4d4d4d)`).
<!-- SECTION:DESCRIPTION:END -->
