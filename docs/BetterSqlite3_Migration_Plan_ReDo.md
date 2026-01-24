# Migration Plan: better-sqlite3 → Node.js node:sqlite

## Executive Summary

**Migration is FEASIBLE** with minor API adjustments. The Node.js native `node:sqlite` module (available since v22.5.0, stable in v23.4.0+) provides comparable functionality to better-sqlite3 without native compilation dependencies. This eliminates the MCP server native module compatibility issues.

**Key Requirement:** Node.js version must be upgraded from >=20.0.0 to >=22.5.0

**Performance Impact:** 5-10% slower (ACCEPTABLE per user confirmation)

---

## 1. Current better-sqlite3 Usage Patterns

### Core Dependencies

**Package Locations:**

- `packages/api-core/package.json`: `"better-sqlite3": "^12.6.2"`
- `apps/tasks-mcp-server/package.json`: `"better-sqlite3": "^12.6.2"` (peerDependency + devDependency)

### Usage Patterns Identified

#### In `packages/api-core/src/database.ts`

1. **Import:**

   ```typescript
   import Database from 'better-sqlite3';
   ```

2. **Database Creation (line 419-422):**

   ```typescript
   const db = new Database(path, {
     timeout: 30000, // 30s timeout for locks
   });
   ```

3. **Schema Operations:**
   - `db.exec()` - Execute SQL statements (12 occurrences)
   - `db.prepare()` - Create prepared statements (used in Session class)

4. **Pragma Calls (6 occurrences):**
   - Line 258: `db.pragma('table_info(features)')` - Check column existence
   - Line 282: `db.pragma('table_info(features)')` - Check column existence
   - Line 386: `db.pragma('table_info(features)')` - Check column existence
   - Line 438: `db.pragma('journal_mode = ${journal_mode}')` - Set WAL/DELETE mode
   - Line 439: `db.pragma('busy_timeout = 30000')` - Set busy timeout

5. **Session Wrapper Pattern:**

   ```typescript
   class Session {
     constructor(public db: Database.Database) {}
     query<T>(sql: string, ...params: any[]): T[] {
       const stmt = this.db.prepare(sql);
       return stmt.all(...params) as T[];
     }
     execute(sql: string, ...params: any[]): Database.RunResult {
       const stmt = this.db.prepare(sql);
       return stmt.run(...params);
     }
   }
   ```

#### In Test Files

- `packages/api-core/src/__tests__/database.test.ts`: Import and use Database type
- All test files use in-memory databases (`:memory:`)

#### In Build Configuration

- `apps/tasks-mcp-server/package.json` build script: `--external:better-sqlite3` (not bundled)

---

## 2. Node.js node:sqlite Module Capabilities

### Module Availability

- **Added:** Node.js v22.5.0 (June 2024)
- **Status:** Stability 1.1 - Active Development (no longer requires `--experimental-sqlite` flag as of v23.4.0)
- **Current:** Available in Node.js v24.x LTS and v25.x

### API Surface Comparison

| Feature                 | better-sqlite3                          | node:sqlite                                       | Migration Notes           |
| ----------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------- |
| **Import**              | `import Database from 'better-sqlite3'` | `import { DatabaseSync } from 'node:sqlite'`      | Simple rename             |
| **Constructor**         | `new Database(path, options)`           | `new DatabaseSync(path, options)`                 | Same pattern              |
| **Timeout Option**      | `timeout: 30000`                        | `timeout: 30000`                                  | ✅ Identical              |
| **Prepared Statements** | `db.prepare(sql)`                       | `db.prepare(sql)`                                 | ✅ Identical              |
| **Statement.all()**     | ✅ Supported                            | ✅ Supported                                      | ✅ Identical              |
| **Statement.get()**     | ✅ Supported                            | ✅ Supported                                      | ✅ Identical              |
| **Statement.run()**     | ✅ Supported                            | ✅ Supported                                      | ✅ Identical              |
| **db.exec()**           | ✅ Supported                            | ✅ Supported                                      | ✅ Identical              |
| **db.pragma()**         | ✅ Supported                            | ❌ **NOT Supported**                              | ⚠️ **Migration Required** |
| **WAL Mode**            | Via `pragma()`                          | Set in constructor: `open: true` + manual exec    | Alternative approach      |
| **RunResult Type**      | `Database.RunResult`                    | Return object with `{ changes, lastInsertRowid }` | Compatible structure      |

### Key API Differences

#### 1. No `pragma()` Method

**Current Usage (better-sqlite3):**

```typescript
const columns = db.pragma('table_info(features)');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
```

**node:sqlite Alternatives:**

1. **For queries (table_info):**

   ```typescript
   // Old: db.pragma('table_info(features)')
   // New: Use prepare + all
   const columns = db.prepare('PRAGMA table_info(features)').all();
   ```

2. **For settings (journal_mode):**

   ```typescript
   // Old: db.pragma('journal_mode = WAL')
   // New: Use exec
   db.exec('PRAGMA journal_mode = WAL');
   ```

3. **For busy_timeout:**

   ```typescript
   // Old: db.pragma('busy_timeout = 30000')
   // New: Use constructor option (already using 'timeout')
   new DatabaseSync(path, { timeout: 30000 });
   ```

#### 2. Constructor Options

**better-sqlite3:**

```typescript
new Database(path, {
  timeout: 30000,
});
```

**node:sqlite (equivalent and more):**

```typescript
new DatabaseSync(path, {
  timeout: 30000, // ✅ Same
  open: true, // Auto-open (default: true)
  readOnly: false, // Read-only mode
  enableForeignKeyConstraints: true, // Foreign keys (default: true)
});
```

---

## 3. MCP Server Specific Concerns with Native Modules

### Problems with better-sqlite3

1. **Native Module Compilation Issues:**
   - Requires node-gyp and C++ build tools
   - Must match Node.js version exactly
   - Windows users need Visual Studio build tools
   - Cross-platform builds require separate compilation

2. **MCP Server Deployment Challenges:**
   - Claude Desktop may use different Node.js version than system
   - Pre-compiled binaries may not match runtime environment
   - Error message: `NODE_MODULE_VERSION mismatch`
   - Common in Electron apps and MCP servers

3. **Real-World Evidence:**
   - UpTier MCP Server documentation explicitly warns about better-sqlite3 issues
   - Common error pattern: "Module did not self-register"
   - Recommended workaround: Use standalone/bundled deployments

### Benefits of node:sqlite Migration

1. **Zero Native Dependencies** - Built into Node.js runtime
2. **Version Compatibility** - Always matches Node.js version
3. **Simplified Distribution** - No compilation required
4. **Cross-Platform** - Works everywhere Node.js works
5. **MCP-Friendly** - No special configuration needed

---

## 4. Feasibility Assessment

### ✅ MIGRATION IS FEASIBLE

**Blockers:** NONE identified

**Changes Required:**

- **6 pragma() calls** → Use `prepare().all()` or `exec()` alternatives
- **1 import statement** → Change `Database` to `DatabaseSync`
- **3+ type references** → Update `Database.Database` to `DatabaseSync`
- **2 package.json files** → Remove better-sqlite3 dependencies
- **1 build script** → Remove `--external:better-sqlite3`
- **Node.js version** → Update minimum to >=22.5.0

**Effort Estimate:** 2-4 hours

**Risk Level:** LOW

- No breaking changes to business logic
- Same API patterns (prepare, exec, all, get, run)
- Comprehensive test suite exists for validation

---

## 5. Key API Differences to Address

### Migration Mapping Table

| Current Code                            | node:sqlite Replacement                                            | Location                  |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| `import Database from 'better-sqlite3'` | `import { DatabaseSync } from 'node:sqlite'`                       | database.ts:8             |
| `new Database(path, { timeout })`       | `new DatabaseSync(path, { timeout })`                              | database.ts:419           |
| `db.pragma('table_info(features)')`     | `db.prepare('PRAGMA table_info(features)').all()`                  | database.ts:258, 282, 386 |
| `db.pragma('journal_mode = WAL')`       | `db.exec('PRAGMA journal_mode = WAL')`                             | database.ts:438           |
| `db.pragma('busy_timeout = 30000')`     | _(Already set via constructor `timeout` option)_                   | database.ts:439 (REMOVE)  |
| `Database.Database`                     | `DatabaseSync`                                                     | Throughout codebase       |
| `Database.RunResult`                    | `{ changes: number \| bigint, lastInsertRowid: number \| bigint }` | database.ts:34            |

### Critical Code Sections

#### 1. database.ts - Migration Functions (Lines 255-397)

All three migration functions use `pragma('table_info(...))`:

```typescript
// Current:
const columns = db.pragma('table_info(features)') as Array<{ name: string }>;

// Replacement:
const columns = db.prepare('PRAGMA table_info(features)').all() as Array<{ name: string }>;
```

#### 2. database.ts - Journal Mode Selection (Lines 438-439)

```typescript
// Current:
const journal_mode = is_network ? 'DELETE' : 'WAL';
db.pragma(`journal_mode = ${journal_mode}`);
db.pragma('busy_timeout = 30000');

// Replacement:
const journal_mode = is_network ? 'DELETE' : 'WAL';
db.exec(`PRAGMA journal_mode = ${journal_mode}`);
// Remove: busy_timeout already set in constructor
```

#### 3. Session Class - Type Annotations

```typescript
// Current:
export class Session {
  constructor(public db: Database.Database) {}
  execute(sql: string, ...params: any[]): Database.RunResult {
    // ...
  }
}

// Replacement:
export class Session {
  constructor(public db: DatabaseSync) {}
  execute(
    sql: string,
    ...params: any[]
  ): { changes: number | bigint; lastInsertRowid: number | bigint } {
    // ...
  }
}
```

---

## 6. Version Requirements & Constraints

### Node.js Version Impact

**Current Requirement:** `"node": ">=20.0.0"`

**New Requirement:** `"node": ">=22.5.0"`

**Dropped Support:**

- Node.js 20.x (LTS until April 2026)
- Node.js 21.x (EOL)

**Supported Versions:**

- ✅ Node.js 22.x LTS (Active until October 2027)
- ✅ Node.js 23.x (Current)
- ✅ Node.js 24.x LTS (Active until April 2029)
- ✅ Node.js 25.x

### Deployment Considerations

**Confirmed:**

- ✅ Node.js 22.5+ requirement is acceptable
- ✅ 5-10% performance decrease is acceptable

---

## 7. Performance Comparison

### Benchmark Data

From GitHub Issue #1266 (better-sqlite3):

- **TL;DR:** "Performance is almost indistinguishable"
- node:sqlite performs slightly slower than better-sqlite3
- Both significantly faster than node-sqlite3 (callback-based)

**Performance Characteristics:**

| Operation           | better-sqlite3 | node:sqlite   | Difference |
| ------------------- | -------------- | ------------- | ---------- |
| Simple Queries      | Baseline       | ~5-10% slower | Negligible |
| Bulk Inserts        | Baseline       | ~5-10% slower | Negligible |
| Transactions        | Baseline       | Comparable    | Minimal    |
| Prepared Statements | Baseline       | Comparable    | Minimal    |

**Recommendation:** Performance difference is negligible for typical MCP server workloads. No benchmarking required unless handling thousands of ops/second.

---

## 8. Implementation Plan

### Step 1: Update database.ts (30 min)

**File:** `packages/api-core/src/database.ts`

**Changes:**

1. **Update import (line 8):**

   ```typescript
   // Old:
   import Database from 'better-sqlite3';

   // New:
   import { DatabaseSync } from 'node:sqlite';
   ```

2. **Replace pragma calls (lines 258, 282, 386):**

   ```typescript
   // Old:
   const columns = db.pragma('table_info(features)') as Array<{ name: string }>;

   // New:
   const columns = db.prepare('PRAGMA table_info(features)').all() as Array<{ name: string }>;
   ```

3. **Replace pragma calls (lines 438-439):**

   ```typescript
   // Old:
   const journal_mode = is_network ? 'DELETE' : 'WAL';
   db.pragma(`journal_mode = ${journal_mode}`);
   db.pragma('busy_timeout = 30000');

   // New:
   const journal_mode = is_network ? 'DELETE' : 'WAL';
   db.exec(`PRAGMA journal_mode = ${journal_mode}`);
   // busy_timeout already set in constructor - remove this line
   ```

4. **Update type references:**
   - Replace all `Database.Database` with `DatabaseSync`
   - Replace all `Database.RunResult` with explicit type `{ changes: number | bigint; lastInsertRowid: number | bigint }`
   - Update constructor: `new DatabaseSync(path, { timeout: 30000 })`

### Step 2: Update package dependencies (10 min)

**File:** `packages/api-core/package.json`

Remove:

```json
"dependencies": {
  "better-sqlite3": "^12.6.2"
}
```

Update:

```json
"engines": {
  "node": ">=22.5.0"
}
```

**File:** `apps/tasks-mcp-server/package.json`

Remove:

```json
"peerDependencies": {
  "better-sqlite3": "^12.6.2"
},
"devDependencies": {
  "better-sqlite3": "^12.6.2"
}
```

Update:

```json
"engines": {
  "node": ">=22.5.0"
}
```

Remove from build script:

```json
// Old:
"build": "... --external:better-sqlite3"

// New:
"build": "..." // Remove the external flag
```

### Step 3: Update root package.json (5 min)

**File:** `package.json`

Update:

```json
"engines": {
  "node": ">=22.5.0",
  "pnpm": ">=10.0.0"
}
```

### Step 4: Run test suite (10 min)

```bash
pnpm install  # Remove better-sqlite3, update lockfile
pnpm test     # Verify all tests pass
```

**Expected Results:**

- All database tests pass
- Migration tests pass
- MCP tool tests pass

### Step 5: Update documentation (30 min)

**Files to update:**

1. **README.md** - Update Node.js requirement
2. **apps/tasks-mcp-server/README.md** - Remove native module warnings
3. **packages/api-core/README.md** - Update prerequisites
4. **docs/SETUP_GUIDE.md** - Update Node.js version requirement

**Changes:**

- Replace "Node.js >=20.0.0" with "Node.js >=22.5.0"
- Remove any mentions of better-sqlite3 native module issues
- Add note about node:sqlite migration completion

---

## 9. Rollback Plan

If issues arise:

1. Revert commit
2. Restore better-sqlite3 dependencies in package.json files
3. Run `pnpm install`
4. Restore Node.js requirement to >=20.0.0

**Risk:** LOW - Changes are isolated to database layer with existing test coverage

---

## 10. Success Criteria

**Migration is successful when:**

1. ✅ All tests pass (`pnpm test`)
2. ✅ MCP server starts without errors
3. ✅ All database operations work (CRUD, migrations)
4. ✅ No better-sqlite3 dependencies remain
5. ✅ Documentation updated
6. ✅ Build succeeds without warnings

---

## 11. Recommendations

### Proceed with Migration

**Rationale:**

1. ✅ Node.js 22.5+ requirement is acceptable (confirmed)
2. ✅ 5-10% performance decrease is acceptable (confirmed)
3. ✅ Eliminates native module deployment issues
4. ✅ Simplifies distribution/deployment
5. ✅ Low risk with comprehensive test coverage

### Next Steps

1. **Implementation:** Follow the 5-step plan above
2. **Testing:** Run full test suite + manual MCP tool validation
3. **Documentation:** Update READMEs with new requirements
4. **Deployment:** Gradual rollout with monitoring

---

## Conclusion

**Migration is HIGHLY RECOMMENDED** for MCP server use cases. The elimination of native module dependencies will resolve common deployment issues while maintaining full functionality. The API changes are minimal and well-documented, with a comprehensive test suite to validate the migration.

**Primary Trade-off:** Node.js version bump (20.x → 22.5+) vs. elimination of native dependencies

**Verdict:** Benefits outweigh the version requirement constraint for MCP server deployments.

**Status:** READY FOR IMPLEMENTATION
