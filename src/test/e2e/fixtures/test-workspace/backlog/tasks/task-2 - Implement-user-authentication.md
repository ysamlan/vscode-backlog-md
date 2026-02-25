---
id: TASK-2
title: Implement user authentication
status: Done
priority: high
milestone: v1.0
labels: [feature]
dependencies: [TASK-6]
subtasks: [TASK-2.1, TASK-2.2, TASK-2.3]
created_date: 2026-02-01
updated_date: 2026-02-06
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add basic user authentication to the application. This includes email-based signup, login with password verification, and persistent sessions using secure HTTP-only cookies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can sign up with email
- [x] #2 Users can log in
- [ ] #3 Sessions are persisted
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `bcrypt` for password hashing and `express-session` for session management
2. Create `POST /auth/signup` — validate email uniqueness, hash password, insert user row
3. Create `POST /auth/login` — verify credentials, issue session cookie
4. Add session middleware that attaches `req.user` from cookie
5. Wire up TASK-2.3 for session persistence with Redis store
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Switched from `bcrypt` to `argon2` after benchmarking — 3x faster hash verification with equivalent security margins. Session secret is loaded from `SESSION_SECRET` env var with a random fallback in dev mode.
<!-- SECTION:NOTES:END -->
