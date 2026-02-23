---
id: TASK-6
title: Refactor database layer
status: In Progress
priority: medium
labels: [feature]
dependencies: [TASK-3]
created_date: 2026-02-04
updated_date: 2026-02-05
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Extract database logic into repository pattern
- [ ] #2 Add connection pooling
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All existing queries migrated to repository pattern
- [ ] #2 Connection pool configured with sensible defaults
- [ ] #3 Integration tests pass against test database
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define `Repository` interface with CRUD methods
2. Implement `PostgresRepository` backed by connection pool
3. Implement `CacheRepository` as a read-through wrapper
4. Migrate existing direct queries one module at a time
5. Add connection pool health checks
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigated both `pg-pool` and `pgBouncer`. Going with `pg-pool` for simplicity since we don't need cross-service pooling yet.

The `users` table queries were migrated first as a proof of concept — all 12 tests pass with the new repository layer.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repository pattern is in place for the `users` and `sessions` modules. Cache layer uses a 60-second TTL with LRU eviction. Connection pool is configured at 10 idle / 50 max connections. Remaining modules (`audit_log`, `preferences`) will be migrated in TASK-9.
<!-- SECTION:FINAL_SUMMARY:END -->
