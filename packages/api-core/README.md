# @gcapnias/api-core

Core API functionality with SQLite database integration for the MCP server monorepo.

## Overview

This package provides a database abstraction layer using SQLite via `better-sqlite3`. It exports the `DatabaseService` class which handles all database operations with a consistent error-handling pattern.

## Features

- 🗃️ **SQLite Integration** - High-performance SQLite database with WAL mode enabled
- 🔄 **Type-Safe API** - Fully typed responses using shared types from `@gcapnias/shared-types`
- ✅ **Consistent Error Handling** - All methods return `ApiResponse<T>` with success/error states
- 🚀 **Optimized Performance** - WAL (Write-Ahead Logging) mode for better concurrency
- 📦 **Schema Management** - Built-in schema initialization

## Installation

This is an internal workspace package. It's automatically linked when you install dependencies:

```bash
# From monorepo root
pnpm install
```

## Usage

### Import

```typescript
import { DatabaseService } from '@gcapnias/api-core';
import type { DatabaseConfig } from '@gcapnias/shared-types';
```

### Basic Example

```typescript
// Create database instance
const config: DatabaseConfig = {
  path: './mydata.db',
  verbose: false, // Set to true for SQL logging
};

const db = new DatabaseService(config);

// Initialize schema
const initResult = db.initialize();
if (!initResult.success) {
  console.error('Failed to initialize:', initResult.error);
  process.exit(1);
}

// Add an item
const addResult = db.addItem('My Item');
if (addResult.success) {
  console.log('Item ID:', addResult.data?.id);
}

// Get all items
const itemsResult = db.getItems();
if (itemsResult.success) {
  console.log('Items:', itemsResult.data);
}

// Always close when done
db.close();
```

### Error Handling

All methods return `ApiResponse<T>`:

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Example:**

```typescript
const result = db.addItem('Test');

if (result.success) {
  // Success case - data is available
  const itemId = result.data.id;
  console.log(`Created item with ID: ${itemId}`);
} else {
  // Error case - error message is available
  console.error(`Failed to add item: ${result.error}`);
}
```

## API Reference

### `DatabaseService`

#### Constructor

```typescript
constructor(config: DatabaseConfig)
```

**Parameters:**
- `config.path` - Path to SQLite database file (will be created if doesn't exist)
- `config.verbose` - Optional. Set to `true` to log all SQL statements

**Example:**
```typescript
const db = new DatabaseService({
  path: './data.db',
  verbose: process.env.NODE_ENV === 'development',
});
```

#### Methods

##### `initialize(): ApiResponse`

Initializes the database schema. Creates the `items` table if it doesn't exist.

**Returns:** `ApiResponse` with success status

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
)
```

**Example:**
```typescript
const result = db.initialize();
if (!result.success) {
  throw new Error(result.error);
}
```

---

##### `getItems(): ApiResponse<Item[]>`

Retrieves all items from the database, ordered by creation date (newest first).

**Returns:** `ApiResponse<Item[]>` where `Item` is:
```typescript
{
  id: number;
  name: string;
  created_at: number; // Unix timestamp
}
```

**Example:**
```typescript
const result = db.getItems();
if (result.success && result.data) {
  result.data.forEach((item) => {
    console.log(`${item.id}: ${item.name}`);
  });
}
```

---

##### `addItem(name: string): ApiResponse<{ id: number }>`

Adds a new item to the database.

**Parameters:**
- `name` - Name of the item (required)

**Returns:** `ApiResponse<{ id: number }>` with the ID of the created item

**Example:**
```typescript
const result = db.addItem('My New Item');
if (result.success) {
  console.log(`Created item with ID: ${result.data?.id}`);
}
```

---

##### `close(): void`

Closes the database connection. Always call this when you're done using the database.

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
  path: string;      // Path to SQLite database file
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

- **`better-sqlite3`** (^11.0.0) - Fast, synchronous SQLite3 bindings
  - ⚠️ **Native module** - Requires compilation for your platform
  - Must match Node.js version
  - See [better-sqlite3 docs](https://github.com/WiseLibs/better-sqlite3) for details

- **`@gcapnias/shared-types`** (workspace) - Shared TypeScript type definitions

### Development Dependencies

- **`@types/better-sqlite3`** - TypeScript definitions for better-sqlite3

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
pnpm test
```

## Type Exports

This package re-exports types from `@gcapnias/shared-types`:

```typescript
import type { 
  DatabaseConfig, 
  ApiResponse,
  ServerConfig 
} from '@gcapnias/api-core';
```

## Performance Considerations

### WAL Mode

The database uses WAL (Write-Ahead Logging) mode which:
- ✅ Allows concurrent reads during writes
- ✅ Faster than traditional rollback journal
- ✅ Better crash recovery
- ⚠️ Creates additional files (`.db-wal`, `.db-shm`)

### Prepared Statements

All queries use prepared statements for:
- Better performance on repeated queries
- Protection against SQL injection
- Type safety

## Error Handling Best Practices

**Always check the `success` field:**

```typescript
const result = db.addItem('Test');
if (!result.success) {
  // Handle error
  logger.error('Database error:', result.error);
  return;
}

// Safe to use result.data
console.log(result.data.id);
```

**Use early returns:**

```typescript
function createItem(name: string) {
  const result = db.addItem(name);
  if (!result.success) {
    throw new Error(`Failed to create item: ${result.error}`);
  }
  return result.data.id;
}
```

## Extending the Schema

To add new tables or modify the schema:

1. Update the `initialize()` method in `src/index.ts`
2. Add corresponding methods for CRUD operations
3. Define return types in `@gcapnias/shared-types`
4. Update this README with new API documentation

**Example:**

```typescript
initialize(): ApiResponse {
  try {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (...);
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

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
- [`@gcapnias/mcp-server`](../../apps/mcp-server) - MCP server application using this API

## License

Private - Internal use only
