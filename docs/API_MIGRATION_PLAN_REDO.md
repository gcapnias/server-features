# Plan: Convert Python API to TypeScript with Name Preservation

Convert the Python library (~850 lines) from [api/](api/) to TypeScript within [packages/api-core/](packages/api-core/), maintaining **exact function name mapping** and **1:1 file structure**. Each Python file gets a matching TypeScript file with identical function signatures using **snake_case naming**. Package-specific utilities go into separate `-utils.ts` files for future Python-to-TypeScript migrations.

## Architecture Decisions

- ✅ **Exact name preservation**: All Python snake_case function names kept in TypeScript
- ✅ **1:1 file mapping**: Each .py file → matching .ts file
- ✅ **Class-based models**: Preserve SQLAlchemy class structure
- ✅ **TSDoc from docstrings**: Convert Python docs preserving Args/Returns
- ✅ **Matching test structure**: database.test.ts, dependency_resolver.test.ts, migration.test.ts
- ✅ **Utility separation**: New TypeScript-only code in `-utils.ts` files
- ✅ **better-sqlite3**: Direct SQLAlchemy replacement
- ✅ **heap-js**: Priority queue for Kahn's algorithm
- ✅ **100-1600ms retry backoff**: SQLITE_BUSY handling

## File Structure Mapping

### Python → TypeScript Correspondence

```text
api/
├── database.py (356 lines)           → packages/api-core/src/database.ts
│   └── 12 functions, 3 classes       → database-utils.ts (TypeScript-only)
│
├── dependency_resolver.py (354)      → packages/api-core/src/dependency_resolver.ts
│   └── 10 functions, 1 TypedDict     → dependency_resolver-utils.ts (TypeScript-only)
│
├── migration.py (124 lines)          → packages/api-core/src/migration.ts
│   └── 2 functions                   → migration-utils.ts (TypeScript-only)
│
└── __init__.py (8 lines)             → packages/api-core/src/index.ts
```

### Support Files (TypeScript-specific)

```text
packages/api-core/src/
├── database-utils.ts         # retry_on_busy, parse_sqlite_error, JSON helpers
├── dependency_resolver-utils.ts  # build_dependency_graph, compute_depth, heap wrapper
├── migration-utils.ts        # create_backup, filesystem utilities
└── __tests__/
    ├── database.test.ts      # Mirrors Python test structure
    ├── dependency_resolver.test.ts
    └── migration.test.ts
```

## Steps

### 1. Create shared types matching Python models

In [packages/shared-types/src/models.ts](packages/shared-types/src/models.ts):

**Interfaces** (matching Python SQLAlchemy models):

```typescript
/**
 * Feature model matching Python database.Feature
 */
interface Feature {
  id: number;
  priority: number;
  category: string;
  name: string;
  description: string;
  steps: string[];
  passes: boolean;
  in_progress: boolean;
  dependencies: number[] | null;
}

/**
 * Schedule model matching Python database.Schedule
 */
interface Schedule {
  id: number;
  project_name: string;
  start_time: string; // "HH:MM" format
  duration_minutes: number;
  days_of_week: number; // bitfield 0-127
  enabled: boolean;
  yolo_mode: boolean;
  model: string | null;
  max_concurrency: number;
  crash_count: number;
  created_at: Date;
}

/**
 * ScheduleOverride model matching Python database.ScheduleOverride
 */
interface ScheduleOverride {
  id: number;
  schedule_id: number;
  override_type: 'start' | 'stop';
  expires_at: Date;
  created_at: Date;
}

/**
 * DependencyResult TypedDict from Python dependency_resolver
 */
interface DependencyResult {
  ordered_features: Feature[];
  circular_dependencies: number[][];
  blocked_features: Map<number, number[]>;
  missing_dependencies: Map<number, number[]>;
}
```

In [packages/shared-types/src/constants.ts](packages/shared-types/src/constants.ts):

```typescript
// From Python dependency_resolver.py
export const MAX_DEPENDENCY_DEPTH = 50;
export const MAX_DEPENDENCIES = 20;
export const MAX_FEATURES = 10000;

// TypeScript-specific retry configuration
export const RETRY_DELAYS = [100, 200, 400, 800, 1600] as const;
```

### 2. Implement database.ts with exact Python function names

Create [packages/api-core/src/database.ts](packages/api-core/src/database.ts):

**Classes** (matching Python SQLAlchemy models):

```typescript
/**
 * Feature class matching Python database.Feature
 * Preserves all SQLAlchemy model behavior
 */
class Feature {
  id: number;
  priority: number;
  category: string;
  name: string;
  description: string;
  steps: string[];
  passes: boolean;
  in_progress: boolean;
  dependencies: number[] | null;

  /**
   * Convert to JSON-serializable dictionary
   * Python: def to_dict(self) -> dict
   */
  to_dict(): Record<string, any> {
    // Implementation
  }

  /**
   * Safely extract dependencies as list
   * Python: def get_dependencies_safe(self) -> list[int]
   */
  get_dependencies_safe(): number[] {
    // Implementation
  }
}

/**
 * Schedule class matching Python database.Schedule
 */
class Schedule {
  // ... fields ...

  /**
   * Convert to JSON-serializable dictionary
   * Python: def to_dict(self) -> dict
   */
  to_dict(): Record<string, any> {
    // Implementation
  }

  /**
   * Check if schedule is active on given weekday
   * Python: def is_active_on_day(self, weekday: int) -> bool
   * @param weekday - Day of week (0=Monday, 6=Sunday)
   */
  is_active_on_day(weekday: number): boolean {
    // Implementation
  }
}

/**
 * ScheduleOverride class matching Python database.ScheduleOverride
 */
class ScheduleOverride {
  // ... fields ...

  /**
   * Convert to JSON-serializable dictionary
   * Python: def to_dict(self) -> dict
   */
  to_dict(): Record<string, any> {
    // Implementation
  }
}
```

**Module-level functions** (exact Python names):

```typescript
/**
 * Get current UTC timestamp
 * Python: def utcnow() -> datetime
 * Replacement for deprecated SQLAlchemy func.now()
 */
function utcnow(): Date {
  return new Date();
}

/**
 * Get path to features.db
 * Python: def get_database_path() -> Path
 * @returns Absolute path to database file
 */
function get_database_path(): string {
  // Implementation using path.join
}

/**
 * Get database connection URL/path
 * Python: def get_database_url() -> str
 * @returns SQLite connection string with POSIX-style paths
 */
function get_database_url(): string {
  // Implementation
}

/**
 * Add dependencies column to legacy databases
 * Python: def add_dependencies_column(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function add_dependencies_column(db: Database): void {
  // Uses PRAGMA table_info, ALTER TABLE
}

/**
 * Fix NULL values in boolean columns
 * Python: def fix_null_boolean_values(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function fix_null_boolean_values(db: Database): void {
  // UPDATE features SET passes=0, in_progress=0 WHERE ...
}

/**
 * Add description TEXT column
 * Python: def add_description_column(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function add_description_column(db: Database): void {
  // ALTER TABLE features ADD COLUMN description TEXT
}

/**
 * Legacy no-op migration function
 * Python: def add_testing_columns(engine) -> None
 * Kept for backwards compatibility
 */
function add_testing_columns(db: Database): void {
  // No-op, originally added removed columns
}

/**
 * Detect network filesystems (UNC, NFS, SMB, CIFS)
 * Python: def detect_network_filesystem(path: str) -> bool
 * @param path - Filesystem path to check
 * @returns True if path is on network filesystem
 */
function detect_network_filesystem(path: string): boolean {
  // Windows: Check for UNC paths (\\server\share)
  // Unix: Read /proc/mounts, check for nfs/cifs/smb
}

/**
 * Create schedules and schedule_overrides tables
 * Python: def create_schedules_table(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function create_schedules_table(db: Database): void {
  // CREATE TABLE IF NOT EXISTS schedules (...)
  // CREATE TABLE IF NOT EXISTS schedule_overrides (...)
  // Adds crash_count/max_concurrency for upgrades
}

/**
 * Initialize database connection
 * Python: def create_database(db_path: str | None = None) -> tuple[Engine, sessionmaker]
 * @param db_path - Optional path to database file
 * @returns Tuple of [Database instance, session factory]
 */
function create_database(db_path?: string): { engine: Database; session_maker: () => Session } {
  // Opens better-sqlite3 connection
  // Configures journal mode (WAL or DELETE based on filesystem)
  // Runs all migrations
  // Sets PRAGMA busy_timeout=30000
}

/**
 * Set global session maker
 * Python: def set_session_maker(session_maker: sessionmaker) -> None
 * @param session_maker - Session factory function
 */
function set_session_maker(session_maker: () => Session): void {
  // Sets module-level _SessionMaker variable
}

/**
 * FastAPI/dependency injection session provider
 * Python: def get_database_session() -> Generator[Session, None, None]
 * @returns Database session with automatic cleanup
 * @throws RuntimeError if session maker not initialized
 */
function* get_database_session(): Generator<Session, void, unknown> {
  // Yields session with try/finally cleanup
}
```

### 3. Create database-utils.ts for TypeScript-specific helpers

Create [packages/api-core/src/database-utils.ts](packages/api-core/src/database-utils.ts):

**New functions** (not in Python):

```typescript
/**
 * Retry operation on SQLITE_BUSY errors
 * Uses exponential backoff: 100, 200, 400, 800, 1600ms
 * @param operation - Function to retry
 * @param operation_name - Name for logging
 * @returns Operation result
 */
async function retry_on_busy<T>(operation: () => T, operation_name: string): Promise<T> {
  // Max 5 attempts with RETRY_DELAYS
  // Logs retries when NODE_ENV=development
}

/**
 * Parse SQLite error into structured ErrorInfo
 * @param error - Error from better-sqlite3
 * @returns Structured error info or null
 */
function parse_sqlite_error(error: Error): ErrorInfo | null {
  // Detects UNIQUE → CONFLICT_DUPLICATE_KEY
  // Detects CHECK → CONFLICT_CONSTRAINT_VIOLATION
  // Detects FOREIGN KEY → CONFLICT_FOREIGN_KEY
  // Detects locked → DATABASE_LOCK_TIMEOUT
}

/**
 * Convert any error to Result error format
 * @param error - Any caught error
 * @returns Result error object
 */
function to_error_result<T>(error: unknown): { success: false; error: ErrorInfo } {
  // Handles DomainError, SQLite errors, unknown errors
}

/**
 * Safely parse JSON array column
 * @param text - JSON string from database
 * @returns Parsed array or null
 */
function parse_json_array<T>(text: string | null): T[] | null {
  // Try-catch wrapper for JSON.parse
}

/**
 * Serialize array to JSON for database storage
 * @param arr - Array to serialize
 * @returns JSON string or null
 */
function serialize_json_array<T>(arr: T[] | null): string | null {
  // JSON.stringify wrapper
}
```

### 4. Implement dependency_resolver.ts with exact Python names

Create [packages/api-core/src/dependency_resolver.ts](packages/api-core/src/dependency_resolver.ts):

**Constants** (from Python):

```typescript
/** Maximum dependency depth to prevent stack overflow */
const MAX_DEPENDENCY_DEPTH = 50;
```

**Functions** (exact Python names with TSDoc):

```typescript
/**
 * Topological sort with comprehensive dependency analysis
 * Python: def topological_sort_with_analysis(features: list[Feature]) -> DependencyResult
 *
 * Uses Kahn's algorithm with min-heap for priority-aware ordering.
 * Detects cycles, missing dependencies, and blocked features.
 *
 * @param features - List of all features
 * @returns Dependency analysis with ordered features, cycles, blocked features
 */
function topological_sort_with_analysis(features: Feature[]): DependencyResult {
  // Kahn's algorithm implementation
  // Priority queue via heap-js
  // Returns comprehensive DependencyResult
}

/**
 * Check if feature dependencies are satisfied
 * Python: def feature_is_ready(feature: Feature, passing_ids: set[int] | None = None) -> bool
 * @param feature - Feature to check
 * @param passing_ids - Optional set of passing feature IDs for optimization
 * @returns True if all dependencies have passes=true
 */
function feature_is_ready(feature: Feature, passing_ids?: Set<number>): boolean {
  // Returns true for features with no dependencies
  // Checks all deps have passes=true
}

/**
 * Get list of incomplete dependency IDs
 * Python: def get_incomplete_dependencies(feature: Feature, passing_ids: set[int] | None = None) -> list[int]
 * @param feature - Feature to check
 * @param passing_ids - Optional set for optimization
 * @returns List of dependency IDs that are not complete
 */
function get_incomplete_dependencies(feature: Feature, passing_ids?: Set<number>): number[] {
  // Returns empty list if all satisfied
}

/**
 * Check if adding edge would create dependency cycle
 * Python: def would_create_cycle(features: list[Feature], source_id: int, target_id: int) -> bool
 *
 * Uses DFS with depth limit for security (MAX_DEPENDENCY_DEPTH=50).
 *
 * @param features - All features
 * @param source_id - Source feature ID
 * @param target_id - Target feature ID
 * @returns True if adding edge creates cycle
 */
function would_create_cycle(features: Feature[], source_id: number, target_id: number): boolean {
  // DFS-based cycle detection
  // Handles self-reference
}

/**
 * Validate dependency list
 * Python: def validate_dependencies(feature_id: int, dependency_ids: list[int], all_feature_ids: set[int]) -> tuple[bool, str]
 *
 * Checks: max limit, self-reference, existence, duplicates
 *
 * @param feature_id - ID of feature being validated
 * @param dependency_ids - List of proposed dependency IDs
 * @param all_feature_ids - Set of all valid feature IDs
 * @returns Tuple of [is_valid, error_message]
 */
function validate_dependencies(
  feature_id: number,
  dependency_ids: number[],
  all_feature_ids: Set<number>
): [boolean, string] {
  // Returns [true, ""] if valid
  // Returns [false, error_message] if invalid
}

/**
 * Find all dependency cycles using DFS
 * Python: def find_cycles_dfs(features: list[Feature]) -> list[list[int]]
 *
 * Internal helper for cycle detection.
 *
 * @param features - All features
 * @returns List of cycles, each cycle is list of feature IDs
 */
function find_cycles_dfs(features: Feature[]): number[][] {
  // DFS with recursion tracking
  // Returns [[1, 3, 5, 1], [2, 4, 2]]
}

/**
 * Calculate priority scores for scheduling
 * Python: def compute_scheduling_scores(features: list[Feature]) -> dict[int, float]
 *
 * Formula: unblocking_potential * 10 + depth * 5 + priority
 *
 * @param features - All features
 * @returns Map of feature_id → score
 */
function compute_scheduling_scores(features: Feature[]): Map<number, number> {
  // Considers: unblocking potential, depth, user priority
}

/**
 * Get features ready to work on
 * Python: def get_ready_features(features: list[Feature]) -> list[Feature]
 *
 * Filters: not passing, not in_progress, dependencies satisfied
 * Sorted by: scheduling score, then priority, then id
 *
 * @param features - All features
 * @returns Sorted list of actionable features
 */
function get_ready_features(features: Feature[]): Feature[] {
  // Returns features ready for work
}

/**
 * Get blocked features with blocking dependency info
 * Python: def get_blocked_features(features: list[Feature]) -> list[Feature]
 *
 * Adds 'blocked_by' field with list of blocking IDs.
 * Excludes already-passing features.
 *
 * @param features - All features
 * @returns Features that are blocked, with blocked_by field
 */
function get_blocked_features(features: Feature[]): (Feature & { blocked_by: number[] })[] {
  // Returns blocked features with blocking info
}

/**
 * Build dependency graph visualization data
 * Python: def build_dependency_graph(features: list[Feature]) -> dict
 *
 * Returns graph with nodes and edges for visualization.
 * Node status: "done", "blocked", "in_progress", "pending"
 *
 * @param features - All features
 * @returns Graph data with nodes and edges arrays
 */
function build_dependency_graph(features: Feature[]): {
  nodes: Array<{ id: number; label: string; status: string }>;
  edges: Array<{ from: number; to: number }>;
} {
  // Builds visualization data
}
```

### 5. Create dependency_resolver-utils.ts for graph utilities

Create [packages/api-core/src/dependency_resolver-utils.ts](packages/api-core/src/dependency_resolver-utils.ts):

**New functions** (not in Python, support topological sort):

```typescript
/**
 * Build adjacency list representation of dependency graph
 * @param features - All features
 * @returns Map of feature_id → array of dependency IDs
 */
function build_adjacency_list(features: Feature[]): Map<number, number[]> {
  // Creates graph structure for traversal
}

/**
 * Calculate depth of feature in dependency tree
 * Python recursion translated to iterative with memoization
 * @param feature_id - Feature to calculate depth for
 * @param graph - Adjacency list graph
 * @param memo - Memoization cache
 * @returns Depth (1 + max(depths of dependencies))
 */
function compute_depth(
  feature_id: number,
  graph: Map<number, number[]>,
  memo: Map<number, number>
): number {
  // Recursive with memoization
}

/**
 * Wrapper for heap-js min-heap with Feature comparator
 */
class MinHeapWrapper {
  private heap: Heap<Feature>;

  constructor() {
    // Comparator: depth ascending, priority descending
  }

  push(feature: Feature): void {}
  pop(): Feature | undefined {}
  size(): number {}
}
```

### 6. Implement migration.ts with exact Python names

Create [packages/api-core/src/migration.ts](packages/api-core/src/migration.ts):

**Functions** (exact Python names):

```typescript
/**
 * Import feature_list.json to SQLite database
 * Python: def migrate_json_to_sqlite(db_path: str | None = None) -> bool
 *
 * Skips if database already has data.
 * Handles both old and new JSON formats.
 * Automatically backs up JSON with timestamp.
 *
 * @param db_path - Optional path to database file
 * @returns True if migration was performed, False if skipped
 */
function migrate_json_to_sqlite(db_path?: string): boolean {
  // Safety check: skip if data exists
  // Create timestamped backup
  // Read and parse JSON
  // Insert features into database
  // Returns true if migration performed
}

/**
 * Export database to JSON file
 * Python: def export_to_json(db_path: str | None = None, output_path: str | None = None) -> str
 *
 * Default output: feature_list_export.json
 * Sorts by priority, then id
 *
 * @param db_path - Optional path to database file
 * @param output_path - Optional output file path
 * @returns Path to exported JSON file
 */
function export_to_json(db_path?: string, output_path?: string): string {
  // Get all features from database
  // Get all schedules and overrides
  // Create JSON structure
  // Write to file (pretty-printed)
  // Return output path
}
```

### 7. Create migration-utils.ts for backup utilities

Create [packages/api-core/src/migration-utils.ts](packages/api-core/src/migration-utils.ts):

**New functions** (not in Python):

```typescript
/**
 * Create timestamped backup of JSON file
 * @param json_path - Path to JSON file
 * @returns Path to backup file
 */
function create_backup(json_path: string): string {
  // Generate timestamp: YYYYMMDD_HHMMSS
  // Create backup: ${json_path}.backup.${timestamp}
  // Copy file
}

/**
 * Safely read JSON file with error handling
 * @param path - Path to JSON file
 * @returns Parsed JSON data
 */
function read_json_safe(path: string): any {
  // Try-catch wrapper for fs.readFileSync + JSON.parse
}

/**
 * Ensure directory exists, create if needed
 * @param path - Directory path
 */
function ensure_directory_exists(path: string): void {
  // Uses fs.mkdirSync with recursive option
}
```

### 8. Update package.json and create test files

**[packages/api-core/package.json](packages/api-core/package.json)**:

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "heap-js": "^2.5.0",
    "@gcapnias/shared-types": "workspace:*"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "@types/better-sqlite3": "^7.6.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**[packages/api-core/src/**tests**/database.test.ts](packages/api-core/src/**tests**/database.test.ts)**:

```typescript
import Database from 'better-sqlite3';
import {
  create_database,
  get_database_path,
  Feature,
  Schedule,
  ScheduleOverride,
  detect_network_filesystem,
} from '../database';

describe('database', () => {
  describe('get_database_path', () => {
    it('should return absolute path to features.db', () => {
      // Test path construction
    });
  });

  describe('create_database', () => {
    it('should create in-memory database', () => {
      // Use ':memory:' for testing
    });

    it('should run migrations successfully', () => {
      // Verify schema created
    });

    it('should configure WAL mode for non-network paths', () => {
      // Check PRAGMA journal_mode
    });
  });

  describe('Feature class', () => {
    it('should convert to dict via to_dict()', () => {
      // Test serialization
    });

    it('should safely extract dependencies', () => {
      // Test get_dependencies_safe()
    });
  });

  describe('detect_network_filesystem', () => {
    it('should detect UNC paths on Windows', () => {
      // Test \\server\share detection
    });

    it('should return false for local paths', () => {
      // Test C:\Users\... paths
    });
  });

  // More tests matching Python test structure
});
```

**[packages/api-core/src/**tests**/dependency_resolver.test.ts](packages/api-core/src/**tests**/dependency_resolver.test.ts)**:

```typescript
import {
  topological_sort_with_analysis,
  feature_is_ready,
  would_create_cycle,
  validate_dependencies,
  find_cycles_dfs,
  get_ready_features,
  MAX_DEPENDENCY_DEPTH,
} from '../dependency_resolver';

describe('dependency_resolver', () => {
  describe('topological_sort_with_analysis', () => {
    it('should sort features by dependencies', () => {
      // Test Kahn's algorithm
    });

    it('should detect circular dependencies', () => {
      // Test cycle detection
    });

    it('should respect priority ordering', () => {
      // Test min-heap comparator
    });
  });

  describe('feature_is_ready', () => {
    it('should return true for features with no deps', () => {
      // Test ready state
    });

    it('should return false if dependencies incomplete', () => {
      // Test blocking
    });
  });

  describe('would_create_cycle', () => {
    it('should detect self-reference', () => {
      // Test source_id === target_id
    });

    it('should detect indirect cycles', () => {
      // Test DFS detection
    });

    it('should respect MAX_DEPENDENCY_DEPTH', () => {
      // Test depth limit
    });
  });

  describe('validate_dependencies', () => {
    it('should enforce MAX_DEPENDENCIES limit', () => {
      // Test 20 dependency limit
    });

    it('should detect missing feature IDs', () => {
      // Test validation
    });

    it('should return [true, ""] for valid deps', () => {
      // Test success case
    });
  });

  // More tests matching Python structure
});
```

**[packages/api-core/src/**tests**/migration.test.ts](packages/api-core/src/**tests**/migration.test.ts)**:

```typescript
import { migrate_json_to_sqlite, export_to_json } from '../migration';
import { create_database } from '../database';

describe('migration', () => {
  describe('migrate_json_to_sqlite', () => {
    it('should skip migration if database has data', () => {
      // Test safety check
    });

    it('should create timestamped backup', () => {
      // Verify backup file created
    });

    it('should import features from JSON', () => {
      // Test import process
    });

    it('should return true when migration performed', () => {
      // Test return value
    });
  });

  describe('export_to_json', () => {
    it('should export all features sorted by priority', () => {
      // Test export ordering
    });

    it('should include schedules and overrides', () => {
      // Test complete export
    });

    it('should return output file path', () => {
      // Test return value
    });
  });
});
```

### 9. Update package exports with Python function names

**[packages/api-core/src/index.ts](packages/api-core/src/index.ts)**:

```typescript
// Python database.py functions and classes
export {
  Feature,
  Schedule,
  ScheduleOverride,
  utcnow,
  get_database_path,
  get_database_url,
  create_database,
  set_session_maker,
  get_database_session,
  detect_network_filesystem,
} from './database';

// Python dependency_resolver.py functions
export {
  topological_sort_with_analysis,
  feature_is_ready,
  get_incomplete_dependencies,
  would_create_cycle,
  validate_dependencies,
  find_cycles_dfs,
  compute_scheduling_scores,
  get_ready_features,
  get_blocked_features,
  build_dependency_graph,
  MAX_DEPENDENCY_DEPTH,
} from './dependency_resolver';

// Python migration.py functions
export { migrate_json_to_sqlite, export_to_json } from './migration';

// TypeScript-only utilities (clearly separated)
export * from './database-utils';
export * from './dependency_resolver-utils';
export * from './migration-utils';

// Re-export shared types
export * from '@gcapnias/shared-types';
```

## Function Name Mapping Table

| Python File            | Python Function                    | TypeScript File        | TypeScript Function                | Type     |
| ---------------------- | ---------------------------------- | ---------------------- | ---------------------------------- | -------- |
| database.py            | `utcnow()`                         | database.ts            | `utcnow()`                         | Function |
| database.py            | `get_database_path()`              | database.ts            | `get_database_path()`              | Function |
| database.py            | `get_database_url()`               | database.ts            | `get_database_url()`               | Function |
| database.py            | `create_database()`                | database.ts            | `create_database()`                | Function |
| database.py            | `detect_network_filesystem()`      | database.ts            | `detect_network_filesystem()`      | Function |
| database.py            | `Feature.to_dict()`                | database.ts            | `Feature.to_dict()`                | Method   |
| database.py            | `Schedule.is_active_on_day()`      | database.ts            | `Schedule.is_active_on_day()`      | Method   |
| dependency_resolver.py | `topological_sort_with_analysis()` | dependency_resolver.ts | `topological_sort_with_analysis()` | Function |
| dependency_resolver.py | `feature_is_ready()`               | dependency_resolver.ts | `feature_is_ready()`               | Function |
| dependency_resolver.py | `would_create_cycle()`             | dependency_resolver.ts | `would_create_cycle()`             | Function |
| dependency_resolver.py | `validate_dependencies()`          | dependency_resolver.ts | `validate_dependencies()`          | Function |
| dependency_resolver.py | `find_cycles_dfs()`                | dependency_resolver.ts | `find_cycles_dfs()`                | Function |
| dependency_resolver.py | `compute_scheduling_scores()`      | dependency_resolver.ts | `compute_scheduling_scores()`      | Function |
| dependency_resolver.py | `get_ready_features()`             | dependency_resolver.ts | `get_ready_features()`             | Function |
| dependency_resolver.py | `get_blocked_features()`           | dependency_resolver.ts | `get_blocked_features()`           | Function |
| dependency_resolver.py | `build_dependency_graph()`         | dependency_resolver.ts | `build_dependency_graph()`         | Function |
| migration.py           | `migrate_json_to_sqlite()`         | migration.ts           | `migrate_json_to_sqlite()`         | Function |
| migration.py           | `export_to_json()`                 | migration.ts           | `export_to_json()`                 | Function |

## New TypeScript-Only Utilities

These functions do NOT exist in Python and go in `-utils.ts` files:

| File                         | Function                    | Purpose                                    |
| ---------------------------- | --------------------------- | ------------------------------------------ |
| database-utils.ts            | `retry_on_busy()`           | SQLITE_BUSY retry with exponential backoff |
| database-utils.ts            | `parse_sqlite_error()`      | Convert SQLite errors to ErrorInfo         |
| database-utils.ts            | `to_error_result()`         | Convert any error to Result format         |
| database-utils.ts            | `parse_json_array()`        | Safe JSON column parsing                   |
| database-utils.ts            | `serialize_json_array()`    | JSON column serialization                  |
| dependency_resolver-utils.ts | `build_adjacency_list()`    | Graph structure builder                    |
| dependency_resolver-utils.ts | `compute_depth()`           | Iterative depth calculation                |
| dependency_resolver-utils.ts | `MinHeapWrapper`            | heap-js abstraction                        |
| migration-utils.ts           | `create_backup()`           | Timestamped file backup                    |
| migration-utils.ts           | `read_json_safe()`          | Safe JSON file reading                     |
| migration-utils.ts           | `ensure_directory_exists()` | Directory creation helper                  |

## TSDoc Conversion from Python Docstrings

**Python docstring format:**

```python
def would_create_cycle(features: list[Feature], source_id: int, target_id: int) -> bool:
    """Check if adding edge would create dependency cycle.

    Uses DFS with depth limit for security (MAX_DEPENDENCY_DEPTH=50).

    Args:
        features: All features
        source_id: Source feature ID
        target_id: Target feature ID

    Returns:
        True if adding edge creates cycle
    """
```

**TypeScript TSDoc format:**

```typescript
/**
 * Check if adding edge would create dependency cycle
 * Python: def would_create_cycle(features: list[Feature], source_id: int, target_id: int) -> bool
 *
 * Uses DFS with depth limit for security (MAX_DEPENDENCY_DEPTH=50).
 *
 * @param features - All features
 * @param source_id - Source feature ID
 * @param target_id - Target feature ID
 * @returns True if adding edge creates cycle
 */
function would_create_cycle(features: Feature[], source_id: number, target_id: number): boolean {
  // Implementation
}
```

**Conversion rules:**

1. Add `Python:` reference line with original signature
2. Convert `Args:` → `@param` with hyphen separator
3. Convert `Returns:` → `@returns`
4. Preserve all security notes, warnings, and detailed descriptions
5. Keep function complexity warnings

## Implementation Ready

All architectural decisions finalized:

- ✅ **Exact Python name preservation** in snake_case
- ✅ **1:1 file structure mapping**
- ✅ **Class-based models** matching SQLAlchemy structure
- ✅ **TSDoc preservation** of all Python docstrings
- ✅ **Matching test files** mirroring Python test structure
- ✅ **Utility separation** in `-utils.ts` files
- ✅ **better-sqlite3** for database
- ✅ **heap-js** for priority queues
- ✅ **100-1600ms retry backoff**
- ✅ **In-memory testing** with `:memory:` database

Ready to execute conversion maintaining full traceability between Python and TypeScript implementations for future migration projects.
