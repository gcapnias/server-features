# Plan: Migrate Python MCP Server to TypeScript (Final)

Convert [migration/mcp_server/feature_mcp.py](migration/mcp_server/feature_mcp.py) functionality to TypeScript in [apps/tasks-mcp-server](apps/tasks-mcp-server), preserving all 18 tool functions with identical names and original Python documentation. Follow established conversion patterns from [packages/api-core](packages/api-core) migrations. Use file-based locking for priority counter synchronization.

## Steps

1. **Research TypeScript MCP SDK** — Identify the official MCP TypeScript library (likely `@modelcontextprotocol/sdk`), its API for tool registration, input validation patterns, and lifecycle management to match Python's `mcp.server` equivalent.

2. **Create validation layer and types** — Add input validation schemas (Zod or native TypeScript) in [apps/tasks-mcp-server/src/schemas.ts](apps/tasks-mcp-server/src/schemas.ts) mirroring Pydantic models, and extend [packages/shared-types/src/models.ts](packages/shared-types/src/models.ts) with tool-specific types.

3. **Implement tool functions** — Create [apps/tasks-mcp-server/src/tools.ts](apps/tasks-mcp-server/src/tools.ts) with all 18 functions preserving exact names, Python documentation comments, and logic from [migration/mcp_server/feature_mcp.py](migration/mcp_server/feature_mcp.py).

4. **Create TypeScript utilities** — Add [apps/tasks-mcp-server/src/tools-utils.ts](apps/tasks-mcp-server/src/tools-utils.ts) for conversion helpers including file-based locking mechanism for `next_priority_counter`, JSON serialization, error formatting, and database session management.

5. **Wire MCP server setup** — Update [apps/tasks-mcp-server/src/index.ts](apps/tasks-mcp-server/src/index.ts) to initialize MCP server, register all tools from `tools.ts`, handle database lifecycle, and manage `DB_PATH` environment variable.

6. **Implement test suite** — Create [apps/tasks-mcp-server/src/**tests**/tools.test.ts](apps/tasks-mcp-server/src/__tests__/tools.test.ts) mirroring [packages/api-core/src/**tests**](packages/api-core/src/__tests__) structure, covering all 18 tool functions with unit tests including concurrent priority assignment scenarios.

7. **Update configuration and dependencies** — Add MCP SDK, validation library (Zod), and file-locking library (proper-lockfile or similar) to [apps/tasks-mcp-server/package.json](apps/tasks-mcp-server/package.json), configure vitest in [apps/tasks-mcp-server/vitest.config.ts](apps/tasks-mcp-server/vitest.config.ts), update [turbo.json](turbo.json) build pipeline if needed, and document usage in [apps/tasks-mcp-server/README.md](apps/tasks-mcp-server/README.md).
