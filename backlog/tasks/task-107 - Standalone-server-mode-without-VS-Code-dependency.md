---
id: TASK-107
title: Standalone server mode without VS Code dependency
status: To Do
assignee: []
created_date: '2026-02-08 18:53'
labels:
  - feature
  - architecture
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a standalone server/browser mode that allows browsing and managing Backlog.md tasks without requiring VS Code. This would make the UI accessible as a standalone web app, similar to how the upstream Backlog.md project serves a web UI. Could reuse the existing Svelte webview components with a lightweight server that provides the same message-passing interface the extension host currently provides.
<!-- SECTION:DESCRIPTION:END -->
