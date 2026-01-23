# MCP Server

A Model Context Protocol (MCP) server built with TypeScript and SQLite.

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
cd apps/mcp-server
pnpm build
```

The build script:

1. Bundles the application with esbuild
2. Excludes `better-sqlite3` as external (not bundled)
3. Adds shebang via esbuild banner
4. Makes the output executable

## Running

### Important: better-sqlite3 Compatibility

The `better-sqlite3` package is a **native module** that must match your Node.js version. Always run the server using:

```bash
npx -p better-sqlite3 .
```

The `-p` flag ensures `better-sqlite3` is available in the execution context with the correct native bindings for your current Node.js version.

### Alternative: Direct Execution

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

- `@myapp/shared-types`: Shared TypeScript types
- `@myapp/api-core`: Core API with SQLite database service

### Peer Dependencies

- `better-sqlite3@^11.0.0`: Native SQLite bindings (not bundled)

## Troubleshooting

### Error: "Cannot find module 'better-sqlite3'"

Make sure you're running with `npx -p better-sqlite3 .` to ensure the native module is available.

### Error: "Module did not self-register"

This indicates a Node.js version mismatch. The `better-sqlite3` native bindings must be compiled for your current Node.js version. Reinstall with:

```bash
pnpm install --force
```
