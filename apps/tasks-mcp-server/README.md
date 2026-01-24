# MCP Server for Feature Management

A Model Context Protocol (MCP) server built with TypeScript and SQLite that provides 18 tools for managing features in the autonomous coding system.

## Overview

This MCP server exposes feature management capabilities through standardized MCP tools. It maintains a SQLite database of features with support for dependencies, priority management, and progress tracking.

### Available Tools

1. **feature_get_stats** - Get progress statistics (passing, in-progress, total, percentage)
2. **feature_get_by_id** - Get a specific feature by ID with full details
3. **feature_get_summary** - Get minimal feature info (id, name, status, dependencies)
4. **feature_mark_passing** - Mark a feature as passing after successful implementation
5. **feature_mark_failing** - Mark a feature as failing (regression detected)
6. **feature_skip** - Skip a feature by moving it to the end of the priority queue
7. **feature_mark_in_progress** - Mark a feature as in-progress
8. **feature_claim_and_get** - Atomically claim and get feature details
9. **feature_clear_in_progress** - Clear in-progress status
10. **feature_create_bulk** - Create multiple features at once with dependencies
11. **feature_create** - Create a single feature
12. **feature_add_dependency** - Add a dependency between features
13. **feature_remove_dependency** - Remove a dependency
14. **feature_get_ready** - Get features ready to implement (dependencies satisfied)
15. **feature_get_blocked** - Get features blocked by dependencies
16. **feature_get_graph** - Get the dependency graph for visualization
17. **feature_set_dependencies** - Set all dependencies at once

## Prerequisites

- **Node.js**: >=20.0.0 (required for native module compatibility)
- **pnpm**: >=9.0.0

## Installation

From the monorepo root:

```bash
pnpm install
```

## Development

### Local Development Workflow

Run the development server with auto-rebuild on workspace changes:

```bash
# From monorepo root
pnpm dev
```

This uses Turborepo's watch mode to automatically rebuild the MCP server when any workspace dependency changes (shared-types, api-core).

### Building

```bash
# From monorepo root
pnpm build

# Or from this package
cd apps/tasks-mcp-server
pnpm build
```

The build script:

1. Bundles the application with esbuild
2. Excludes `better-sqlite3` as external (not bundled)
3. Adds shebang via esbuild banner
4. Makes the output executable

## Testing

Run the test suite:

```bash
# From monorepo root
pnpm test

# Or from this package
cd apps/tasks-mcp-server
pnpm test

# Watch mode
pnpm test:watch
```

## Running

### Environment Variables

- **PROJECT_DIR**: Directory where the SQLite database will be created (default: current directory)
- **DB_PATH**: Full path to the SQLite database file (overrides PROJECT_DIR)

### Important: better-sqlite3 Compatibility

The `better-sqlite3` package is a **native module** that must match your Node.js version.

### As an MCP Server

Configure in your MCP client (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "features": {
      "command": "node",
      "args": ["path/to/autocoder-playground/apps/tasks-mcp-server/dist/index.js"],
      "env": {
        "PROJECT_DIR": "/path/to/your/project"
      }
    }
  }
}
```

### Direct Execution (for testing)

If you have `better-sqlite3` installed globally or in your local node_modules:

```bash
node dist/index.js
# or
./dist/index.js
```

## Architecture

This MCP server demonstrates:

- **Monorepo structure** with shared types and core API
- **Native module handling** (better-sqlite3 as external peer dependency)
- **esbuild bundling** with platform-specific configuration
- **TypeScript project references** for incremental builds

## Dependencies

### Workspace Dependencies

- `@gcapnias/shared-types`: Shared TypeScript types
- `@gcapnias/api-core`: Core API with SQLite database service

### Peer Dependencies

- `better-sqlite3@^12.6.2`: Native SQLite bindings (not bundled)

## Troubleshooting

### Error: "Cannot find module 'better-sqlite3'"

Make sure you're running with `npx -p better-sqlite3 .` to ensure the native module is available.

### Error: "Module did not self-register"

This indicates a Node.js version mismatch. The `better-sqlite3` native bindings must be compiled for your current Node.js version. Reinstall with:

```bash
pnpm install --force
```
