---
id: TASK-3
title: Fix login redirect bug
status: To Do
priority: high
milestone: v1.1
labels: [bug]
dependencies: [TASK-2.3]
created_date: 2026-02-02
updated_date: 2026-02-05
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users are not redirected to the dashboard after successful login.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Login redirects to dashboard
- [ ] #2 Remember last visited page
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace the login form submit handler to find where redirect is (not) happening
2. Check if `returnTo` query param is being captured before the auth redirect
3. After successful login, redirect to `returnTo` or default to `/dashboard`
4. Add integration test covering the redirect-after-login flow
<!-- SECTION:PLAN:END -->
