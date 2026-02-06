---
id: TASK-95
title: Support image upload and embedding in task editor
status: To Do
priority: medium
labels: [feature, task-detail, images]
created: 2025-02-06
---

# Support image upload and embedding in task editor

## Overview

Allow users to upload images from within the task detail editor and have them saved to `backlog/assets/images/` with a proper markdown image reference inserted into the task description. This aligns with the upstream Backlog.md convention where images live in `backlog/assets/images/` and are referenced via relative markdown paths like `![alt](../assets/images/filename.png)`.

## Upstream context

The upstream Backlog.md repo (MrLesk/Backlog.md) supports images via convention:
- The web server serves files from `backlog/assets/` with proper MIME types (png, jpeg, gif, svg, webp, avif)
- The `backlog/assets/images/` directory is used by convention but is **not** auto-created by `initializeProject()`
- No dedicated image utility functions exist — images are standard markdown content in the task body
- The `Task` type has no structured attachment/image fields; images are purely inline markdown
- Relative path convention from task files: `../assets/images/filename.png` (up from `tasks/` to `backlog/`)

**This is largely greenfield work.** The upstream repo has no upload utilities, no structured attachment/image fields on the Task type, and the `assets/images/` directory isn't even auto-scaffolded. The only existing support is the web server's `/assets/*` route with MIME type mappings. We're building the full upload-and-embed flow from scratch.

## Implementation plan

### Task editor UI changes

- Add an image upload button (Lucide `image-plus` or `upload` icon) to the description toolbar area
- Support both:
  - Click to open file picker (accept image types: png, jpg, gif, svg, webp)
  - Drag-and-drop onto the description editor area (nice to have)
  - Paste from clipboard (nice to have, common in GitHub-style editors)
- Show upload progress indicator while the image is being saved

### Extension backend

- Handle a new `uploadImage` message from the webview containing the image data (base64 or binary)
- Auto-create `backlog/assets/images/` directory if it doesn't exist
- Generate a filename: use a slug based on the task ID and a short hash or timestamp, e.g., `task-95-1706140800.png`
- Write the file to `backlog/assets/images/<filename>`
- Return the relative markdown path to the webview: `../assets/images/<filename>`

### Markdown insertion

- Insert `![<filename>](../assets/images/<filename>)` at the cursor position in the description editor
- If the editor is in preview mode, switch to edit mode first and append at the end

### Image rendering in preview

- The description preview (markdown renderer) should render `<img>` tags for image references
- Since we're in a VS Code webview, we need to use `webview.asWebviewUri()` to convert the file path to a webview-accessible URI
- The extension must provide a URI mapping so the webview can resolve `../assets/images/...` paths to actual webview URIs

## Acceptance criteria

- [ ] User can click an upload button in the task detail description area
- [ ] Selected image is saved to `backlog/assets/images/` with a reasonable filename
- [ ] Markdown image reference is inserted into the description
- [ ] Image renders correctly in the description preview within the VS Code webview
- [ ] `backlog/assets/images/` is auto-created if it doesn't exist
- [ ] Supported formats: PNG, JPEG, GIF, SVG, WebP
- [ ] Error handling for oversized files or unsupported formats

## Future / related work

- **Image cleanup on task deletion** — When a task is deleted, consider removing images that are only referenced by that task. This is non-trivial because images may be manually referenced from other tasks or linked in external documents. Should be a separate task (see below).
- **Clipboard paste support** — Paste images directly from clipboard into the editor (common in GitHub/Notion-style editors)
- **Drag-and-drop support** — Drop image files onto the description area
- **Image thumbnails in list/kanban views** — Show a small preview of the first image in card views
