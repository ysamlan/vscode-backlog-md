---
id: TASK-163
title: >-
  Show Acceptance Criteria & Definition of Done in the Kanban/List Details
  preview panel
status: Done
assignee:
  - '@yoni'
created_date: '2026-06-18 12:59'
updated_date: '2026-06-18 13:55'
labels:
  - bug
  - ui
dependencies: []
references:
  - 'https://github.com/ysamlan/vscode-backlog-md/issues/30'
modified_files:
  - src/webview/components/tasks/CompactTaskDetails.svelte
  - src/webview/components/tasks/TaskPreviewView.svelte
  - src/providers/TaskPreviewViewProvider.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The compact "Details" preview panel shown in the Kanban/List view (CompactTaskDetails.svelte, fed by TaskPreviewViewProvider) renders Description plus Implementation Plan/Notes/Final Summary (when present), but never renders Acceptance Criteria or Definition of Done for any task. This makes tasks whose only body content is AC/DoD (commonly subtasks) appear to show "only a Description" in the panel, while tasks that also have an Implementation Plan (often parent tasks) look fuller. Users must click "Edit" (open the full editor) to see AC/DoD at all.

Goal: surface AC and DoD directly in the compact preview panel as interactive checklists, so users can see and tick/untick items without leaving the panel. This removes the confusing parent-vs-subtask asymmetry (it was never subtask-specific — the panel simply omitted these sections).

The full Task object (including acceptanceCriteria and definitionOfDone) is already sent to the preview webview via taskPreviewData, so no parser/data changes are needed. Toggling should mirror the existing toggleChecklistItem flow already implemented in TaskDetailProvider (writer.toggleChecklistItem + refresh), and must respect read-only (cross-branch) tasks.

Reported in GitHub issue #30.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The compact Details preview panel displays the task's Acceptance Criteria as a checklist whenever the task has at least one AC item
- [x] #2 The compact Details preview panel displays the task's Definition of Done as a checklist whenever the task has at least one DoD item
- [x] #3 AC and DoD sections render identically for subtasks and parent tasks (no asymmetry); a subtask with AC/DoD no longer appears to show only the Description
- [x] #4 AC and DoD sections are hidden when the task has no items for that section, consistent with how Plan/Notes/Final Summary only render when present
- [x] #5 Each checklist shows a progress indicator (e.g. '2 of 5 complete') and reflects checked/unchecked state
- [x] #6 Clicking a checkbox in the preview toggles the item, persists the change to the task markdown file on disk, and refreshes the panel
- [x] #7 Checkbox toggling is disabled for read-only (cross-branch) tasks, matching existing read-only guards
- [x] #8 A unit test covers TaskPreviewViewProvider handling the checklist-toggle message (persists via writer and refreshes)
- [x] #9 A Playwright webview test covers toggling an Acceptance Criteria item in the compact preview and verifying the correct message is posted
- [x] #10 bun run test, bun run lint, and bun run typecheck all pass
- [x] #11 Toggling an Acceptance Criteria item never changes a Definition of Done item that shares the same #number (and vice-versa): BacklogWriter.toggleChecklistItem scopes the toggle to the given listType's section, with a BacklogWriter regression test covering a task that has AC #1 and DoD #1
- [x] #12 The preview checklist-toggle message carries the displayed task's identity (taskId + filePath/source/branch) and the provider toggles that exact task rather than whatever is currently selected, closing the select-then-click-before-refresh race; unit and Playwright tests updated to assert the identity is sent and used
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. CompactTaskDetails.svelte: add Acceptance Criteria and Definition of Done checklist sections between Description and Implementation Plan. Render each only when its items array is non-empty. Show a progress indicator ("N of M complete"). Render read-only-style checkbox buttons that call a new onToggleChecklistItem(listType, itemId) prop; disable when isReadOnly. Reuse existing compact styling conventions.
2. TaskPreviewView.svelte: add handleToggleChecklistItem(listType, itemId) that posts { type: 'toggleChecklistItem', listType, itemId }; pass it down to CompactTaskDetails.
3. TaskPreviewViewProvider.ts: add a 'toggleChecklistItem' case in handleMessage. Resolve the currently selected task, apply the read-only mutation guard, call writer.toggleChecklistItem(taskId, listType, itemId, parser), then onTaskUpdated() + refresh().
4. Tests (TDD): unit test that TaskPreviewViewProvider handles the toggle message (persists via writer, refreshes); Playwright webview test that toggling an AC checkbox in the compact preview posts the correct message.
5. Run bun run test && bun run lint && bun run typecheck; mark ACs and Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause was not subtask-specific: CompactTaskDetails.svelte (the Kanban/List compact 'Details' preview) never rendered Acceptance Criteria or Definition of Done for any task. It only rendered Description (always) plus Plan/Notes/Final Summary (conditionally). Parent tasks with an Implementation Plan looked 'full' while subtasks whose only body was Description+AC+DoD appeared to show 'only Description'. The full Task object (incl. acceptanceCriteria/definitionOfDone) was already sent via taskPreviewData, so no provider/parser data changes were needed for display.

Implemented AC/DoD as interactive read-write checklists in the preview (user chose toggle-capable over read-only). Added an onToggleChecklistItem prop to CompactTaskDetails, a {#snippet checklist(...)} that renders each list (gated on non-empty, with an 'N of M complete' progress indicator and disabled checkboxes when isReadOnly). TaskPreviewView posts { type: 'toggleChecklistItem', listType, itemId } (taskId omitted; provider resolves the selected task, matching the existing TaskDetail webview pattern). TaskPreviewViewProvider gained a 'toggleChecklistItem' case that applies the read-only guard, calls writer.toggleChecklistItem(...), then onTaskUpdated()+refresh().

Verified: bun run typecheck, bun run lint, bun run test (894 unit), and bun run test:playwright (280 webview, incl. 7 new preview-checklist tests) all pass. Environment note: this checkout had no node_modules; ran bun install, and Playwright browsers were refreshed (project Playwright is now 1.60.0 after a bun update, matching chromium build 1223).

Codex review (/codex:review --base main) surfaced two P2 correctness issues in the new interactive toggle, both confirmed: (1) BacklogWriter.toggleChecklistItem ignores its listType param and toggles by a GLOBAL `#id` regex, so a task with AC #1 and DoD #1 flips both when either is clicked — pre-existing in the shared writer, also affects the full TaskDetail editor; the original AC-only tests missed it. (2) The preview toggle message omitted the task identity and the provider resolved from selectedTaskRef, allowing a select-then-click-before-refresh race to mutate the wrong task — also inconsistent with the preview's own updateTask messages which carry taskId. Reopened TASK-163 to fix both (user chose to keep them in this task).

Fixed both Codex findings under this task. (1) BacklogWriter.toggleChecklistItem now honors listType: added a findChecklistSectionRange helper (mirroring updateChecklistInBody's marker->header->fallback boundary logic) and scopes the toggle regex to that section, so toggling AC #1 no longer flips DoD #1. This also fixes the same latent bug in the full TaskDetail editor, which calls the same writer method. 3 BacklogWriter regression tests added (AC+DoD sharing #1, both directions, plus a legacy no-marker file). (2) The preview toggle message now carries the displayed task's identity (taskId + filePath/source/branch); WebviewMessage.toggleChecklistItem extended with optional filePath/source/branch; the provider resolves that task via resolveTask(message-identity) instead of selectedTaskRef, closing the select-then-click-before-refresh race. Added a provider unit test that selects TASK-B then sends a TASK-A toggle and asserts TASK-A is the one written; updated the read-only and persist tests and the Playwright toggle test to include/expect taskId.

Verified after fixes: bun run typecheck + lint clean; 898 unit tests pass (incl. 3 new writer regression tests + 1 new provider race test); 280 Playwright tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixes GitHub issue #30. The Kanban/List "Details" preview panel now shows a task's Acceptance Criteria and Definition of Done as interactive checklists, eliminating the confusing case where subtasks (whose body is typically Description + AC + DoD) appeared to show only a Description until the user clicked Edit.

The bug was a missing render, not a subtask-vs-parent or parsing difference: the compact preview (CompactTaskDetails.svelte) previously rendered only Description + Plan/Notes/Final Summary and never AC/DoD. The full task data was already delivered to the webview, so the fix is front-end-focused plus a small provider handler.

Changes:
- CompactTaskDetails.svelte: render AC and DoD via a reusable {#snippet}, gated on non-empty (consistent with Plan/Notes), with a progress indicator and checkboxes that toggle. Disabled for read-only (cross-branch) tasks. New onToggleChecklistItem prop + styles.
- TaskPreviewView.svelte: post a toggleChecklistItem message on checkbox click.
- TaskPreviewViewProvider.ts: handle toggleChecklistItem — read-only guard, persist via BacklogWriter.toggleChecklistItem, then onTaskUpdated + refresh (mirrors TaskDetailProvider).

Tests: 3 new unit tests (payload includes AC/DoD; toggle persists+refreshes; read-only is blocked) and 7 new Playwright tests (renders AC/DoD with progress, hides when empty, toggle posts correct message, read-only disabled + posts nothing). Full suite green: 894 unit + 280 Playwright, lint and typecheck clean.

Follow-up (Codex review): fixed two P2 correctness issues the review surfaced in the new interactive toggle. (1) Cross-section toggle bug — BacklogWriter.toggleChecklistItem ignored its listType and matched checklist lines by a global #id regex, so toggling AC #1 also flipped DoD #1 (and this affected the full editor too); it now scopes the replace to the targeted section via a findChecklistSectionRange helper. (2) Wrong-task race — the preview toggle message now carries the displayed task's identity (taskId/filePath/source/branch) and the provider acts on that task instead of the currently-selected one. Added 3 writer regression tests + 1 provider race test and updated existing toggle tests; full suite green (898 unit + 280 Playwright, lint + typecheck clean).
<!-- SECTION:FINAL_SUMMARY:END -->
