# Plan: Convert Python API to TypeScript in api-core

Convert the Python library (~800 lines) from [api/](api/) to TypeScript within [packages/api-core/](packages/api-core/), implementing a complete feature management system with dependency resolution, scheduling, and migrations. Uses **heap-js**, **100-1600ms retry backoff**, **forward-only migrations**, **MAX_FEATURES=10000**, **deferred dependency validation**, **immediate schedule validation**, **audit trail for overrides**, **stateless graph resolution**, and **in-memory SQLite testing**.

## Steps

### 1. Create shared type definitions and constants

In [packages/shared-types/src/](packages/shared-types/src/):

**[errors.ts](packages/shared-types/src/errors.ts)** - Define error infrastructure:

- `ErrorCategory` enum: VALIDATION, NOT_FOUND, CONFLICT, CIRCULAR_DEPENDENCY, DATABASE, INTERNAL, CONFIGURATION
- `ErrorCode` enum with 25+ granular codes covering all error scenarios
- `ErrorInfo` interface: `{ code, message, category, metadata?, cause?, timestamp, stackTrace? }`
- `Result<T>` discriminated union: `{ success: true; data: T } | { success: false; error: ErrorInfo }`

**[models.ts](packages/shared-types/src/models.ts)** - Define domain models:

- `Feature` interface: id, priority, category, name, description, steps: string[], passes, in_progress, dependencies: number[] | null
- `Schedule` interface: id, project_name, start_time, duration_minutes, days_of_week, enabled, yolo_mode, model, max_concurrency, crash_count, created_at
- `ScheduleOverride` interface: id, schedule_id, override_type: 'start'|'stop', expires_at, created_at
- `DependencyResult` interface: ordered_features, circular_dependencies: number[][], blocked_features, missing_dependencies

**[constants.ts](packages/shared-types/src/constants.ts)** - Define limits:

- `MAX_DEPENDENCIES = 20`
- `MAX_DEPTH = 50`
- `MAX_FEATURES = 10000`
- `RETRY_DELAYS = [100, 200, 400, 800, 1600]`

### 2. Implement domain error classes

**[packages/api-core/src/errors.ts](packages/api-core/src/errors.ts)** - Create error hierarchy:

- `DomainError` base class:
  - Constructor: message, code, category, metadata?, cause?
  - `toErrorInfo(includeStack: boolean)` method checking `process.env.NODE_ENV === 'development'`
  - Preserve error cause chain using Error.cause

- `ValidationError` extends DomainError:
  - Constructor: field, reason, value?
  - Metadata: `{ field, reason, value }`

- `NotFoundError` extends DomainError:
  - Constructor: resource, identifier
  - Metadata: `{ resource, identifier }`

- `ConflictError` extends DomainError:
  - Constructor: resource, constraint, details?
  - Metadata: `{ resource, constraint, details }`

- `CircularDependencyError` extends DomainError:
  - Constructor: cycle array (e.g., `[1, 3, 5, 1]`)
  - Metadata: `{ cycle: number[] }` with full path for debugging

### 3. Build retry logic and error parsing

**[packages/api-core/src/database.ts](packages/api-core/src/database.ts)** - Helper functions:

- `retryOnBusy<T>(operation: () => T, operationName: string): T`:
  - Uses async/await with delays from `RETRY_DELAYS` constant
  - Catches errors checking for "SQLITE_BUSY" or "locked" in message
  - Logs retry attempts with `console.warn()` when `NODE_ENV=development`
  - Max 5 attempts, then throws final error

- `parseSqliteError(error: Error): ErrorInfo | null`:
  - Detects UNIQUE constraint → `ErrorCode.CONFLICT_DUPLICATE_KEY`
  - Detects CHECK constraint → `ErrorCode.CONFLICT_CONSTRAINT_VIOLATION`
  - Detects FOREIGN KEY → `ErrorCode.CONFLICT_FOREIGN_KEY`
  - Detects database locked → `ErrorCode.DATABASE_LOCK_TIMEOUT`
  - Returns structured `ErrorInfo` or null if not SQLite error

- `toErrorResult<T>(error: unknown): { success: false; error: ErrorInfo }`:
  - Converts `DomainError` via `toErrorInfo(isDevelopment)`
  - Calls `parseSqliteError()` for SQLite errors
  - Fallback to `INTERNAL_UNEXPECTED_ERROR` with cause/stack

### 4. Create forward-only migration system

**[packages/api-core/src/migrations.ts](packages/api-core/src/migrations.ts)** - Migration infrastructure:

- `createMigrationsTable(db: Database)`:
  - Creates `migrations_version` table with single integer row

- Migration functions array:
  - `migration_001_initial_schema()`: Creates features, schedules, schedule_overrides tables with all columns, types, CHECK constraints
  - `migration_002_add_composite_index()`: Creates `ix_feature_status` on (status columns)
  - `migration_003_add_foreign_keys()`: Adds CASCADE DELETE on schedule_overrides.schedule_id
  - Additional migrations as needed

- `getCurrentVersion(db: Database): number`:
  - Queries migrations_version table, returns 0 if empty

- `setVersion(db: Database, version: number)`:
  - Updates/inserts version number

- `detectNetworkFilesystem(path: string): boolean`:
  - Checks Windows UNC paths (starts with `\\`)
  - Checks Linux NFS/CIFS mount points (read /proc/mounts if available)
  - Returns true if network filesystem detected

- `runMigrations(db: Database)`:
  - Gets current version
  - Filters unapplied migrations
  - Executes within transaction using `db.transaction()`
  - Sets WAL mode unless network filesystem detected
  - Catches errors and recommends JSON export for manual recovery
  - Updates version after successful migrations

### 5. Extend DatabaseService with full CRUD operations

**[packages/api-core/src/database.ts](packages/api-core/src/database.ts)** - Expand service:

**Constructor**:

- Accepts `DatabaseConfig`
- Opens database with better-sqlite3
- Calls `runMigrations(this.db)`
- Stores `isDevelopment = process.env.NODE_ENV === 'development'`

**JSON helpers**:

- `parseJsonArray<T>(text: string | null): T[] | null`:
  - Safely parses with try-catch
  - Returns null on parse error or null input
- `serializeJsonArray<T>(arr: T[] | null): string | null`:
  - Uses `JSON.stringify()`
  - Returns null for null input

**Feature CRUD**:

- `addFeature(feature: Omit<Feature, 'id'>): Result<{ id: number }>`:
  - Validates name/description non-empty (throws `ValidationError`)
  - Counts existing features, throws if >= MAX_FEATURES
  - Does NOT validate dependency references exist (deferred)
  - Wraps INSERT in `retryOnBusy()`
  - Returns `{ success: true, data: { id } }` or error

- `getFeature(id: number): Result<Feature>`:
  - Validates id is positive integer
  - Wraps SELECT in `retryOnBusy()`
  - Parses JSON dependencies column
  - Throws `NotFoundError` if not found

- `updateFeature(id: number, updates: Partial<Feature>): Result<void>`:
  - Validates updates object
  - Serializes JSON arrays if present
  - Wraps UPDATE in `retryOnBusy()`
  - Throws `NotFoundError` if no rows affected

- `deleteFeature(id: number): Result<void>`:
  - Wraps DELETE in `retryOnBusy()`
  - Throws `NotFoundError` if no rows affected

- `getAllFeatures(): Result<Feature[]>`:
  - Wraps SELECT in `retryOnBusy()`
  - Parses JSON columns for all rows
  - Returns array

**Schedule CRUD**:

- `addSchedule(schedule: Omit<Schedule, 'id'>): Result<{ id: number }>`:
  - Validates start_time with regex: `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/`
  - Validates duration_minutes: `>= 1 && <= 1440`
  - Validates days_of_week bitfield: `>= 0 && <= 127`
  - Throws `ValidationError` for any violation
  - Wraps INSERT in `retryOnBusy()`

- `getSchedule(id: number): Result<Schedule>`
- `updateSchedule(id: number, updates: Partial<Schedule>): Result<void>`
- `deleteSchedule(id: number): Result<void>` (CASCADE deletes overrides)
- `getAllSchedules(): Result<Schedule[]>`

**ScheduleOverride CRUD** (keeps expired records for audit trail):

- `addScheduleOverride(override: Omit<ScheduleOverride, 'id'>): Result<{ id: number }>`:
  - Validates schedule_id exists (FK constraint will catch)
  - Validates override_type is 'start' or 'stop'
  - Validates expires_at is future ISO timestamp
  - Wraps INSERT in `retryOnBusy()`

- `getScheduleOverride(id: number): Result<ScheduleOverride>`
- `getActiveOverrides(scheduleId: number): Result<ScheduleOverride[]>`:
  - Filters WHERE `expires_at > datetime('now')` AND `schedule_id = ?`
  - Consumers responsible for filtering expired records

- `getAllOverrides(scheduleId?: number): Result<ScheduleOverride[]>`:
  - Returns all overrides (including expired) for audit trail
  - Optional filter by schedule_id

- `deleteScheduleOverride(id: number): Result<void>`

### 6. Port dependency resolution algorithms

**[packages/api-core/src/dependency-resolver.ts](packages/api-core/src/dependency-resolver.ts)** - Create resolver:

Import `Heap` from heap-js package.

**`DependencyResolver` class** (stateless, rebuilds graph each call):

- `topologicalSort(features: Feature[]): Feature[]`:
  - Implements Kahn's algorithm
  - Builds in-degree map and adjacency list from features
  - Creates min-heap: `new Heap<Feature>((a, b) => compareFeatures(a, b))`
  - Comparator prioritizes by (depth ascending, priority descending)
  - Processes nodes from heap, adds to result, decrements in-degrees
  - Returns ordered features array
  - Throws if cycles exist (shouldn't happen after cycle detection)

- `detectCycles(features: Feature[]): number[][]`:
  - Uses DFS with recursion stack
  - Tracks visited/in-stack states
  - MAX_DEPTH=50 guard prevents stack overflow
  - Collects all cycle paths as arrays of feature IDs
  - Returns array of cycles: `[[1, 3, 5, 1], [2, 4, 2]]`
  - Helper can throw `CircularDependencyError` with first cycle in metadata

- `validateDependencies(features: Feature[]): { valid: boolean; errors: string[] }`:
  - Checks each feature:
    - Self-reference: `dependencies.includes(feature.id)`
    - MAX_DEPENDENCIES limit: `dependencies.length > 20`
    - Missing dependency IDs (informational only, not error)
  - Returns validation result with error messages
  - Does NOT throw (validation is deferred to analyzer)

- `computeSchedulingScore(feature: Feature, unblockingPotential: number, depth: number): number`:
  - Formula: `unblockingPotential * 10 + depth * 5 + feature.priority`
  - Higher score = higher priority for scheduling

- `getReadyFeatures(features: Feature[]): Feature[]`:
  - Filters features where all dependencies have `passes === true`
  - Returns features ready to work on

- `getBlockedFeatures(features: Feature[]): Map<number, number[]>`:
  - Returns map of feature ID → array of blocking dependency IDs
  - Blocking = dependencies with `passes === false`

- `analyzeDependencies(features: Feature[]): Result<DependencyResult>`:
  - Orchestrates full analysis:
    1. Validates dependencies (collect errors)
    2. Detects cycles (throws if found)
    3. Topologically sorts features
    4. Computes ready/blocked features
    5. Calculates scheduling scores
  - Rebuilds all graph structures from scratch (stateless)
  - Returns `Result<DependencyResult>` with ordered_features, circular_dependencies, blocked_features, missing_dependencies
  - Catches `CircularDependencyError` and converts to Result error

**Helper functions**:

- `buildDependencyGraph(features: Feature[]): Map<number, number[]>`:
  - Creates adjacency list representation

- `computeDepth(featureId: number, graph: Map, memo: Map): number`:
  - Recursive depth calculation with memoization
  - Depth = 1 + max(depths of dependencies)

### 7. Create migration utilities

**[packages/api-core/src/migration-utils.ts](packages/api-core/src/migration-utils.ts)** - Data import/export:

Import Node.js `fs` and `path` modules.

- `createBackup(jsonPath: string): Result<string>`:
  - Generates timestamp: `YYYYMMDD_HHMMSS`
  - Creates backup path: `${jsonPath}.backup.${timestamp}`
  - Uses `fs.copyFileSync(jsonPath, backupPath)`
  - Returns `Result<string>` with backup path
  - Handles file not found gracefully

- `importFromJson(db: DatabaseService, jsonPath: string): Result<{ featuresImported: number; schedulesImported: number }>`:
  - Safety check: calls `db.getAllFeatures()` and `db.getAllSchedules()`, throws if count > 0
  - Creates backup via `createBackup(jsonPath)`
  - Reads JSON: `fs.readFileSync(jsonPath, 'utf-8')`
  - Validates structure against TypeScript interfaces
  - Iterates features array, calls `db.addFeature()` for each
  - Does NOT validate dependency references (deferred validation)
  - Iterates schedules array, calls `db.addSchedule()` for each
  - Returns import counts
  - Wraps in try-catch returning Result error on failure

- `exportToJson(db: DatabaseService, outputPath: string): Result<void>`:
  - Calls `db.getAllFeatures()`, returns error if failed
  - Calls `db.getAllSchedules()`, returns error if failed
  - Calls `db.getAllOverrides()` (includes expired for audit)
  - Creates JSON object:

    ```json
    {
      "exported_at": "2026-01-23T10:30:00Z",
      "features": [...],
      "schedules": [...],
      "schedule_overrides": [...]
    }
    ```

  - Writes with `fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))`
  - Pretty-printed for human readability
  - Returns `Result<void>`

### 8. Update dependencies, exports, and testing

**[packages/api-core/package.json](packages/api-core/package.json)**:

- Add dependencies:
  - `"heap-js": "^2.5.0"`
  - `"@types/node": "^20.0.0"`
- Add devDependencies:
  - `"jest": "^29.0.0"`
  - `"@types/jest": "^29.0.0"`
  - `"ts-jest": "^29.0.0"`
- Add scripts:
  - `"test": "jest"`
  - `"test:watch": "jest --watch"`

**[packages/api-core/src/index.ts](packages/api-core/src/index.ts)** - Public API exports:

```typescript
// Core services
export { DatabaseService } from './database';
export { DependencyResolver } from './dependency-resolver';

// Migration utilities
export { createBackup, importFromJson, exportToJson } from './migration-utils';

// Error classes
export * from './errors';

// Re-export shared types and constants
export * from '@gcapnias/shared-types';
```

**[apps/mcp-server/src/error-adapter.ts](apps/mcp-server/src/error-adapter.ts)** - MCP error mapping:

```typescript
import { ErrorInfo, ErrorCategory } from '@gcapnias/shared-types';

const MCP_ERROR_CODES = {
  INVALID_PARAMS: -32602, // Validation errors
  NOT_FOUND: -32001, // Resource not found
  CONFLICT: -32002, // Conflicts and circular dependencies
  INTERNAL_ERROR: -32603, // Database/internal errors
} as const;

export function toMcpError(error: ErrorInfo) {
  let mcpCode: number;

  switch (error.category) {
    case ErrorCategory.VALIDATION:
      mcpCode = MCP_ERROR_CODES.INVALID_PARAMS;
      break;
    case ErrorCategory.NOT_FOUND:
      mcpCode = MCP_ERROR_CODES.NOT_FOUND;
      break;
    case ErrorCategory.CONFLICT:
    case ErrorCategory.CIRCULAR_DEPENDENCY:
      mcpCode = MCP_ERROR_CODES.CONFLICT;
      break;
    default:
      mcpCode = MCP_ERROR_CODES.INTERNAL_ERROR;
  }

  return {
    code: mcpCode,
    message: error.message,
    data: {
      errorCode: error.code,
      category: error.category,
      metadata: error.metadata,
      timestamp: error.timestamp,
    },
  };
}
```

**[packages/api-core/src/**tests**/database.test.ts](packages/api-core/src/**tests**/database.test.ts)** - Integration tests:

- Use in-memory database: `new Database(':memory:')`
- Test migrations run successfully
- Test CRUD operations for all models
- Test retry logic with simulated SQLITE_BUSY
- Test MAX_FEATURES limit enforcement
- Test schedule validation (time format, duration, days_of_week)
- Test JSON column serialization/parsing
- Test error handling and Result types
- Test SQLite constraint violations mapped to domain errors

**[packages/api-core/src/**tests**/dependency-resolver.test.ts](packages/api-core/src/**tests**/dependency-resolver.test.ts)** - Algorithm tests:

- Test Kahn's topological sort with various dependency graphs
- Test cycle detection returns full cycle paths
- Test MAX_DEPENDENCIES limit (21 deps should fail validation)
- Test MAX_DEPTH limit prevents infinite recursion
- Test scheduling score calculation
- Test getReadyFeatures filters correctly
- Test getBlockedFeatures returns blocking dependencies
- Test analyzeDependencies orchestration
- Test stateless behavior (multiple calls with same data)

**[packages/api-core/README.md](packages/api-core/README.md)** - Comprehensive documentation:

**Sections**:

1. **Overview**: Feature management system with dependency resolution
2. **Installation**: pnpm install instructions
3. **Quick Start**: Basic usage example
4. **API Reference**:
   - DatabaseService methods with signatures and examples
   - DependencyResolver methods with examples
   - Migration utilities
5. **Error Handling**:
   - Result type pattern explanation
   - Error categories and codes
   - Code examples for each consumer type (MCP server, CLI)
6. **Architecture**:
   - Retry behavior (100-1600ms backoff)
   - Migration strategy (forward-only)
   - MAX_FEATURES=10000 limit rationale
   - Deferred dependency validation design
   - Schedule override audit trail approach
   - Stateless graph resolution
7. **Testing**:
   - In-memory SQLite approach
   - Running tests
   - Test coverage
8. **Disaster Recovery**:
   - JSON export for backups
   - Import procedure
   - Migration rollback via export/import
9. **Examples**:
   - Full workflows
   - MCP server integration
   - CLI application integration

## Implementation Ready

All architectural decisions finalized:

- ✅ heap-js for priority queues
- ✅ 100-1600ms retry backoff
- ✅ Forward-only migrations
- ✅ Deferred dependency validation
- ✅ Immediate schedule validation
- ✅ Audit trail for overrides
- ✅ Stateless graph resolution
- ✅ In-memory SQLite testing
- ✅ Hybrid error handling (internal DomainError classes, external Result types)
- ✅ Environment-aware stack traces
- ✅ Full cycle paths in circular dependency errors
- ✅ Automatic SQLITE_BUSY retry logic
- ✅ Global MAX_FEATURES=10000 limit

Ready to execute conversion from Python to TypeScript with complete feature parity plus enhanced error handling, type safety, and testing infrastructure.
