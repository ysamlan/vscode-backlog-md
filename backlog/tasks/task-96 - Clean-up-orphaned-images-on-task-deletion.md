---
id: TASK-96
title: Clean up orphaned images on task deletion
status: To Do
priority: low
labels: [feature, images, cleanup]
dependencies: [TASK-95]
created: 2025-02-06
---

# Clean up orphaned images on task deletion

## Overview

When a task is deleted (or permanently removed from archive), images in `backlog/assets/images/` that were uploaded for that task may become orphaned. This task adds optional cleanup logic that detects and removes images no longer referenced by any task.

## Why this is separate from TASK-95

Image cleanup is deceptively complex because:
- An image may have been manually linked in other tasks' descriptions
- An image may be referenced from documents or decisions (`backlog/docs/`, `backlog/decisions/`)
- An image may be referenced from external tools or documentation outside the backlog
- Users may want to keep images even after removing the referencing task

Doing this wrong risks data loss, so it deserves its own task with careful design.

## Implementation considerations

### Reference scanning approach

Before deleting an image, scan all markdown files under `backlog/` for references to that image filename:
- `backlog/tasks/*.md`
- `backlog/drafts/*.md`
- `backlog/archive/tasks/*.md`
- `backlog/docs/*.md` (if supported)
- `backlog/decisions/*.md` (if supported)

Only delete the image if zero references remain after the task deletion.

### UX options

1. **Silent cleanup** — Automatically remove unreferenced images (risky, no undo)
2. **Prompt the user** — "This task has N associated images. Delete them too?" with a list
3. **Orphan report** — A command/action that scans for unreferenced images and lets the user bulk-delete (safest)

Option 2 or 3 is recommended. Option 3 could be a separate "Clean up assets" command in the extension.

### Filename convention helps

If TASK-95 uses a naming convention like `task-95-<hash>.png`, it's easy to identify which images "belong" to a task by filename prefix — even without scanning markdown content. This is a useful heuristic but shouldn't be the only check (images could be re-linked in other tasks).

## Acceptance criteria

- [ ] When a task is deleted, detect images that were referenced only by that task
- [ ] Prompt the user before deleting associated images
- [ ] Do NOT delete images that are still referenced by other tasks or documents
- [ ] Handle edge cases: images referenced by archived tasks, images with no task prefix in filename
