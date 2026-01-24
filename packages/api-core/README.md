# @gcapnias/api-core

Core API package providing SQLite database models, dependency resolution, and migration utilities. This package is a TypeScript implementation matching Python's `api/` module structure with exact function name preservation.

## Overview

This package provides three main modules migrated from Python:

- **database** - Feature, Schedule, and ScheduleOverride models with SQLite integration
- **dependency_resolver** - Topological sorting, cycle detection, and dependency management
- **migration** - JSON to SQLite migration and export utilities

All functions maintain exact Python naming conventions (snake_case) for API compatibility.

## Features

- 🗃️ **SQLite Integration** - High-performance database with better-sqlite3 v12.x
- 🔄 **Dependency Resolution** - Kahn's algorithm with priority scheduling
- 📦 **Migration Tools** - Automatic JSON to SQLite conversion with backups
- 🎯 **Type-Safe API** - Full TypeScript types from `@gcapnias/shared-types`
- 📝 **Python Name Preservation** - All function names match Python exactly
- ✅ **Comprehensive Tests** - 88 test cases covering all functionality

## Installation

This is an internal workspace package:

```bash
# From monorepo root
pnpm install
```

## Usage

### Database Models

```typescript
import { Feature, Schedule, create_database, get_database_path } from '@gcapnias/api-core';

// Create database
const db_path = get_database_path('./data');
const { engine, session_maker } = create_database(db_path);

// Create a feature
const feature = new Feature({
  id: 1,
  priority: 10,
  category: 'core',
  name: 'User Authentication',
  description: 'Implement login system',
  steps: ['Design schema', 'Create endpoints', 'Add tests'],
  passes: false,
  in_progress: false,
  dependencies: null,
});

// Convert to dictionary
const feature_dict = feature.to_dict();
console.log(feature_dict);
```

### Dependency Resolution

```typescript
import {
  resolve_dependencies,
  are_dependencies_satisfied,
  get_blocking_dependencies,
  would_create_circular_dependency,
  get_ready_features,
} from '@gcapnias/api-core';

// Resolve dependencies with topological sort
const result = resolve_dependencies(features);
console.log('Ordered:', result.ordered_features);
console.log('Cycles:', result.circular_dependencies);
console.log('Blocked:', result.blocked_features);

// Check if dependencies are satisfied
const passing_ids = new Set([1, 2, 3]);
const is_ready = are_dependencies_satisfied(feature, passing_ids);

// Get features ready to work on
const ready = get_ready_features(features, 10);

// Check for circular dependencies before adding
const would_cycle = would_create_circular_dependency(features, source_id, target_id);
```

### Migration Utilities

```typescript
import { migrate_json_to_sqlite, export_to_json } from '@gcapnias/api-core';

// Migrate from JSON to SQLite
const migrated = migrate_json_to_sqlite('./project');
if (migrated) {
  console.log('Migration complete!');
}

// Export back to JSON
const json_path = export_to_json('./project');
console.log(`Exported to: ${json_path}`);
```

## API Reference

### Database Module (`database.ts`)

#### Classes

**`Feature`** - Test case/feature model

- `to_dict(): object` - Convert to JSON-serializable dictionary
- `get_dependencies_safe(): number[]` - Safely extract dependencies

**`Schedule`** - Time-based schedule for automated runs

- `to_dict(): object` - Convert to dictionary
- `is_active_on_day(weekday: number): boolean` - Check if active on given day

**`ScheduleOverride`** - Manual schedule override

- `to_dict(): object` - Convert to dictionary

**`Session`** - Database session wrapper

- `query<T>(sql, ...params): T[]` - Execute query
- `execute(sql, ...params): RunResult` - Execute statement
- `beginTransaction()`, `commit()`, `rollback()` - Transaction control

#### Functions

Python function names are preserved exactly:

- `get_database_path(project_dir?: string): string`
- `get_database_url(project_dir?: string): string`
- `create_database(db_path?: string): { engine, session_maker }`
- `set_session_maker(session_maker: () => Session): void`
- `get_db(): Generator<Session>` - Session provider with cleanup
- `_is_network_path(filepath: string): boolean` - Detect network filesystems

### Dependency Resolver Module (`dependency_resolver.ts`)

All functions preserve Python naming:

- `resolve_dependencies(features: Feature[]): DependencyResult`
  - Topological sort using Kahn's algorithm with priority-aware ordering
  - Returns ordered features, cycles, blocked features, and missing dependencies

- `are_dependencies_satisfied(feature: Feature, passing_ids: Set<number>): boolean`
  - Check if all dependencies have passes=true

- `get_blocking_dependencies(feature: Feature, passing_ids: Set<number>): number[]`
  - Get list of incomplete dependency IDs

- `would_create_circular_dependency(features: Feature[], source_id: number, target_id: number): boolean`
  - Check if adding edge would create cycle using DFS

- `validate_dependencies(feature_id: number, dependency_ids: number[], all_feature_ids: Set<number>): [boolean, string]`
  - Validate dependency list (max limit, self-reference, existence, duplicates)

- `_detect_cycles(features: Feature[]): number[][]`
  - Find all dependency cycles using DFS (internal helper)

- `compute_scheduling_scores(features: Feature[]): Map<number, number>`
  - Calculate priority scores for scheduling

- `get_ready_features(features: Feature[], limit?: number): Feature[]`
  - Get features ready to work on (not passing, not in progress, dependencies satisfied)

- `get_blocked_features(features: Feature[]): Array<Feature & { blocked_by: number[] }>`
  - Get blocked features with blocking dependency info

- `build_graph_data(features: Feature[]): { nodes, edges }`
  - Build dependency graph visualization data

### Migration Module (`migration.ts`)

Python function names preserved:

- `migrate_json_to_sqlite(project_dir?: string, session_maker?: () => Session): boolean`
  - Import feature_list.json to SQLite database
  - Skips if database already has data
  - Creates timestamped backup of JSON file
  - Returns true if migration performed

- `export_to_json(project_dir?: string, session_maker?: () => Session, output_path?: string): string`
  - Export database to JSON file
  - Default output: feature_list_export.json
  - Sorts by priority, then id
  - Returns path to exported file

**Example:**

```typescript
try {
  // Use database...
} finally {
  db.close();
}
```

## Configuration

### DatabaseConfig

```typescript
interface DatabaseConfig {
  path: string; // Path to SQLite database file
  verbose?: boolean; // Enable SQL statement logging
}
```

### SQLite Settings

The `DatabaseService` automatically configures:

- **WAL Mode** - Write-Ahead Logging for better concurrency
- **Auto-increment IDs** - Primary keys use SQLite's AUTOINCREMENT
- **Unix Timestamps** - Automatic timestamp generation using SQLite's `strftime`

## Dependencies

### Production Dependencies

- **`better-sqlite3`** (^12.6.2) - Fast, synchronous SQLite3 bindings
  - ⚠️ **Native module** - Requires compilation for your platform
  - Must match Node.js version
  - See [better-sqlite3 docs](https://github.com/WiseLibs/better-sqlite3) for details

- **`heap-js`** (^2.7.1) - Priority queue for scheduling algorithms

- **`@gcapnias/shared-types`** (workspace) - Shared TypeScript type definitions

### Development Dependencies

- **`@types/better-sqlite3`** - TypeScript definitions for better-sqlite3
- **`@types/node`** - Node.js TypeScript definitions
- **`vitest`** - Fast unit test framework

## Development

### Building

```bash
# From package directory
pnpm build

# Watch mode
pnpm dev

# Clean build artifacts
pnpm clean
```

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

**Test Coverage:** 88 tests across 3 test suites (database, dependency_resolver, migration)

## Type Exports

This package re-exports all types from `@gcapnias/shared-types`:

```typescript
import type {
  Feature,
  Schedule,
  ScheduleOverride,
  DependencyResult,
  MAX_DEPENDENCIES,
  MAX_DEPENDENCY_DEPTH,
} from '@gcapnias/api-core';
```

## Python API Compatibility

All functions maintain exact Python naming for cross-language compatibility:

| Python Module          | Python Function                      | TypeScript Module      | Match |
| ---------------------- | ------------------------------------ | ---------------------- | ----- |
| database.py            | `get_database_path()`                | database.ts            | ✅    |
| database.py            | `create_database()`                  | database.ts            | ✅    |
| database.py            | `get_db()`                           | database.ts            | ✅    |
| dependency_resolver.py | `resolve_dependencies()`             | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `are_dependencies_satisfied()`       | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `get_blocking_dependencies()`        | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `would_create_circular_dependency()` | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `validate_dependencies()`            | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `_detect_cycles()`                   | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `compute_scheduling_scores()`        | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `get_ready_features()`               | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `get_blocked_features()`             | dependency_resolver.ts | ✅    |
| dependency_resolver.py | `build_graph_data()`                 | dependency_resolver.ts | ✅    |
| migration.py           | `migrate_json_to_sqlite()`           | migration.ts           | ✅    |
| migration.py           | `export_to_json()`                   | migration.ts           | ✅    |

**Total: 22 Python functions migrated with exact name preservation**

## Performance Considerations

### WAL Mode

The database automatically uses WAL (Write-Ahead Logging) on local filesystems:

- ✅ Allows concurrent reads during writes
- ✅ Faster than traditional rollback journal
- ✅ Better crash recovery
- ⚠️ Creates additional files (`.db-wal`, `.db-shm`)

Network filesystems automatically use DELETE mode for safety.

### Dependency Resolution

- **Kahn's Algorithm** - O(V + E) topological sort
- **Priority Queue** - Min-heap for priority-aware ordering (heap-js)
- **Cycle Detection** - DFS with depth limit (MAX_DEPENDENCY_DEPTH=50)
- **Security** - Max 20 dependencies per feature (MAX_DEPENDENCIES)

## Architecture

### File Structure

```text
packages/api-core/src/
├── database.ts                      # Python: database.py
├── dependency_resolver.ts           # Python: dependency_resolver.py
├── migration.ts                     # Python: migration.py
├── database-utils.ts                # TypeScript-only utilities
├── dependency_resolver-utils.ts     # TypeScript-only utilities
├── migration-utils.ts               # TypeScript-only utilities
├── index.ts                         # Main exports
└── __tests__/
    ├── database.test.ts
    ├── dependency_resolver.test.ts
    └── migration.test.ts
```

### Design Principles

1. **Python Name Preservation** - All exported functions use Python's snake_case naming
2. **Utility Separation** - TypeScript-specific helpers in `-utils.ts` files
3. **No API Wrapper** - Direct function exports, not wrapped in classes
4. **Type Safety** - Full TypeScript with JSDoc referencing Python signatures
5. **Test Parity** - Test structure mirrors Python tests

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

Ensure dependencies are installed:

```bash
pnpm install
```

### "Module did not self-register"

Node.js version mismatch. Reinstall native modules:

```bash
pnpm install --force
```

### Database locked errors

If using the database from multiple processes, ensure proper connection management and consider using WAL mode's checkpoint settings.

## Related Packages

- [`@gcapnias/shared-types`](../shared-types) - Shared TypeScript type definitions
- [`@gcapnias/tasks-mcp-server`](../../apps/tasks-mcp-server) - MCP server application using this API

## License

Private - Internal use only
