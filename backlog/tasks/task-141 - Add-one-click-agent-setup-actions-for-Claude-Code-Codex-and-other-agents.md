---
id: TASK-141
title: 'Add one-click agent setup actions for Claude Code, Codex, and other agents'
status: To Do
assignee: []
created_date: '2026-02-10 14:40'
labels: []
dependencies:
  - TASK-136
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement onboarding actions that let users run the correct terminal commands for Backlog binary install and MCP server setup for Claude Code/Codex, and provide a fallback link to official install instructions for other agents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Init/onboarding UI includes buttons for "Add to Claude Code", "Add to Codex", and "Other agents".
- [ ] #2 "Add to Claude Code" runs the appropriate command sequence in a terminal to install required Backlog binaries and add MCP server configuration.
- [ ] #3 "Add to Codex" runs the appropriate command sequence in a terminal to install required Backlog binaries and add MCP server configuration.
- [ ] #4 "Other agents" opens the official Backlog.md installation/setup instructions instead of attempting unsupported automated setup.
- [ ] #5 Command execution paths include basic failure handling/user feedback so users know whether setup succeeded or what to do next.
- [ ] #6 Automated tests are added or updated for message handling/command wiring, and existing relevant tests continue to pass.
<!-- AC:END -->
