---
id: TASK-141
title: 'Add one-click agent setup actions for Claude Code, Codex, and other agents'
status: Done
assignee: []
created_date: '2026-02-10 14:40'
updated_date: '2026-02-10 18:35'
labels: []
dependencies:
  - TASK-136
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement onboarding actions that let users run the correct terminal commands for Backlog binary install and MCP server setup for Claude Code/Codex, and provide a fallback link to official install instructions for other agents.

Additionally, the extension should **proactively detect** whether the user's workspace already has a working agent integration set up, and surface an install prompt if not — not just during the init flow, but anytime the backlog sidebar is visible.

**Detection heuristics (check on activation and after init):**
- **Claude Code**: Look for a `backlog` MCP server entry in `.claude/settings.json` or `.claude/settings.local.json` in the workspace root (or `~/.claude/` for global config). Also check if `CLAUDE.md` / `AGENTS.md` in the workspace root contains Backlog.md MCP guidelines (the `<!-- BACKLOG.MD MCP GUIDELINES START -->` marker).
- **Codex**: Check for a `backlog` MCP entry in `.codex/config.json` or equivalent Codex workspace config. Also check if `AGENTS.md` contains the Backlog.md marker.
- **Other agents**: Check for the `AGENTS.md` marker as a general signal.

If no integration is detected, the extension should show a visible but non-intrusive prompt (e.g. an info bar or banner in the sidebar, or a notification) with quick-action buttons to install the integration. The user should be able to permanently dismiss the prompt for the current workspace (persisted via `globalState`).

This detection + prompt should work in two contexts:
1. **Post-init flow**: After the init wizard completes, check and offer integration setup immediately.
2. **Existing backlog, no integration**: When the extension activates on a workspace that already has a `backlog/` folder but no detected agent integration, surface the prompt in the sidebar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Init/onboarding UI includes buttons for "Add to Claude Code", "Add to Codex", and "Other agents".
- [ ] #2 "Add to Claude Code" runs the appropriate command sequence in a terminal to install required Backlog binaries and add MCP server configuration.
- [ ] #3 "Add to Codex" runs the appropriate command sequence in a terminal to install required Backlog binaries and add MCP server configuration.
- [ ] #4 "Other agents" opens the official Backlog.md installation/setup instructions instead of attempting unsupported automated setup.
- [ ] #5 Command execution paths include basic failure handling/user feedback so users know whether setup succeeded or what to do next.
- [ ] #6 Automated tests are added or updated for message handling/command wiring, and existing relevant tests continue to pass.
- [ ] #7 Onboarding UI or post-setup guidance mentions shell completions (`backlog completion install`) as a recommended step after CLI binary installation.
- [ ] #8 Extension detects whether a Backlog MCP integration is configured for the workspace (checks Claude Code settings, Codex config, and CLAUDE.md/AGENTS.md for the Backlog.md MCP marker).
- [ ] #9 If no agent integration is detected, a non-intrusive prompt is shown in the sidebar (info banner or similar) with buttons to set up integration.
- [ ] #10 The integration prompt appears both after the init wizard and on activation of an existing backlog workspace with no detected integration.
- [ ] #11 Users can permanently dismiss the integration prompt per-workspace (persisted in globalState), and the dismissal is respected on subsequent activations.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `backlog.setupAgentIntegration` command registered in package.json and extension.ts. CLI available: opens terminal with `backlog init`. CLI not available: detects bun/npm, runs install + init. No package manager: shows info message with link to upstream docs. Banner in Tasks view triggers the command via webview message. Package manager detection prefers bun over npm.
<!-- SECTION:FINAL_SUMMARY:END -->
