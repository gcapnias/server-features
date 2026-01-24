# Plan: Migrate from better-sqlite3 to node:sqlite

Migrate from the native `better-sqlite3` package to Node.js built-in `node:sqlite` module, eliminating native compilation dependencies while maintaining full functionality. The migration requires updating 6 `pragma()` calls, package dependencies, and Node.js version requirement to >=22.5.0.

## Steps

1. **Update [packages/api-core/src/database.ts](packages/api-core/src/database.ts)** - Replace `Database` import with `DatabaseSync`, refactor 3 `pragma()` calls to use `prepare().all()` or `exec()`, move `busy_timeout` from pragma to constructor option
2. **Update [packages/api-core/src/database-utils.ts](packages/api-core/src/database-utils.ts)** - Refactor network path detection to use `exec()` instead of `pragma()` for journal_mode configuration
3. **Clean package dependencies** - Remove `better-sqlite3` and `@types/better-sqlite3` from [packages/api-core/package.json](packages/api-core/package.json) and [apps/tasks-mcp-server/package.json](apps/tasks-mcp-server/package.json), update Node.js engine requirement to `>=22.5.0` in root [package.json](package.json)
4. **Update build configuration** - Remove `--external:better-sqlite3` from [apps/tasks-mcp-server/package.json](apps/tasks-mcp-server/package.json) build script
5. **Validate with test suite** - Run `pnpm test` to verify all database operations, MCP tools, and migration logic work correctly with new API
6. **Update documentation** - Remove native module warnings from [apps/tasks-mcp-server/README.md](apps/tasks-mcp-server/README.md) and [packages/api-core/README.md](packages/api-core/README.md), update Node.js version requirements

## Further Considerations

1. **Node.js version bump** - Moving to >=22.5.0 drops support for Node.js 20.x and 21.x. Is this acceptable for your deployment targets?
2. **Performance validation** - While node:sqlite should have comparable performance, consider benchmarking critical operations if performance is mission-critical
