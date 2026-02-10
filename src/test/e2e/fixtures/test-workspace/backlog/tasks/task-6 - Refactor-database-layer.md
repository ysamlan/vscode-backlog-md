---
id: TASK-6
title: Refactor database layer
status: In Progress
priority: medium
labels: [feature]
dependencies: [TASK-3]
created: 2026-02-04
updated_date: 2026-02-05
ordinal: 2000
---

# Refactor database layer

## Description

This task has no milestone assigned to test the "no milestone" case.

### Current Architecture

```mermaid
graph TD
    A[API Handler] --> B[Service Layer]
    B --> C[Direct DB Queries]
    C --> D[(PostgreSQL)]
    B --> E[Direct DB Queries]
    E --> F[(Redis Cache)]
```

### Target Architecture

```mermaid
graph TD
    A[API Handler] --> B[Service Layer]
    B --> C[Repository Interface]
    C --> D[PostgresRepository]
    C --> E[CacheRepository]
    D --> F[(PostgreSQL)]
    E --> G[(Redis Cache)]
    D --> H[Connection Pool]

    style C fill:#2196F3,color:#fff
    style H fill:#4CAF50,color:#fff
```

### Sequence: Query with Cache

```mermaid
sequenceDiagram
    participant S as Service
    participant R as Repository
    participant C as Cache
    participant DB as Database

    S->>R: getUser(id)
    R->>C: lookup(key)
    alt Cache Hit
        C-->>R: cached data
    else Cache Miss
        C-->>R: null
        R->>DB: SELECT * FROM users
        DB-->>R: row data
        R->>C: store(key, data)
    end
    R-->>S: User object
```

## Acceptance Criteria

- [ ] Extract database logic into repository pattern
- [ ] Add connection pooling
