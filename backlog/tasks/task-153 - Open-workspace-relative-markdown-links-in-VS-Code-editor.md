---
id: TASK-153
title: Open workspace-relative markdown links in VS Code editor
status: In Progress
assignee: []
created_date: '2026-04-18 12:05'
updated_date: '2026-04-18 12:05'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clicking a relative markdown link inside a task description, document, or decision should open the referenced file in a real editor tab (with line jump if the link has an Lstart[-Lend] anchor), instead of toggling the section into edit mode or navigating the webview to a non-existent localhost path.

Implementation:
- New core helper that resolves a workspace-relative path against vscode.workspace.workspaceFolders and opens it via vscode.open, jumping to a Range when an Lstart[-Lend] fragment is present.
- Webview interceptor on the rendered markdown containers that catches clicks on relative <a> elements (no scheme, not pure fragment), preventDefaults the navigation, stops propagation so the edit-toggle no longer fires, and posts an openWorkspaceFile message.
- Wire the new message in TaskDetailProvider and ContentDetailProvider to call the helper.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Relative markdown links in task description sections open the referenced file in a VS Code editor instead of toggling edit mode
- [ ] #2 Links with #L42 or #L42-L51 anchors open the file with the corresponding range selected
- [ ] #3 Document and decision detail panes apply the same behavior
- [ ] #4 External links (http://, https://, mailto:, vscode:) and pure fragment links are not intercepted
<!-- AC:END -->
