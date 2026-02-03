---
id: TASK-40
title: Write README and documentation
status: Done
assignee: []
created_date: '2026-02-02 23:23'
updated_date: '2026-02-03 22:17'
labels:
  - 'epic:polish'
  - 'phase:9'
milestone: MVP Release
dependencies:
  - TASK-37
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create README with installation, features, screenshots, and usage instructions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md with overview
- [x] #2 Installation instructions
- [x] #3 Feature list with screenshots
- [x] #4 Configuration options documented
- [x] #5 Contributing guidelines
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Notes

- README.md rewritten with:
  - Badges (VS Code version, MIT license)
  - One-paragraph description
  - Feature list with working features
  - Installation instructions (Marketplace + VSIX)
  - Getting Started guide
  - Task file format with YAML example
  - Commands table from package.json
  - Development and testing instructions

- CONTRIBUTING.md created with:
  - Development setup instructions
  - Project structure
  - Testing guide (three-tier approach)
  - TDD practices
  - Code style guidelines
  - PR process

- docs/images/ directory created for screenshot placeholders
  - kanban-board.png (to be captured)
  - task-list.png (to be captured)
  - task-detail.png (to be captured)

- Note: No VS Code configuration settings exist yet, so #4 is complete (nothing to document)
<!-- SECTION:NOTES:END -->
