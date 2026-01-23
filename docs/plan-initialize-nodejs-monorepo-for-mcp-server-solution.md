# Plan: Initialize Node.js Monorepo for MCP Server Project

Set up a production-ready monorepo using pnpm workspaces + Turborepo with proper dependency ordering (shared-types → api-core → mcp-server), using esbuild to bundle MCP server with better-sqlite3 as external peerDependency for platform compatibility.

## Steps

1. **Create foundational configuration files** including [.gitignore](.gitignore) FIRST (before installs), then [pnpm-workspace.yaml](pnpm-workspace.yaml), root [package.json](package.json) with `packageManager` and engines fields plus root `dev` script using `turbo watch`, [turbo.json](turbo.json) with dev pipeline (`cache: false, persistent: true`) and native module exclusions, and [.npmrc](.npmrc) with `engine-strict=true`
2. **Configure TypeScript and code quality** with root [tsconfig.json](tsconfig.json) using `composite: true` for project references, [.eslintrc.json](.eslintrc.json), [.prettierrc.json](.prettierrc.json), and [.editorconfig](.editorconfig)
3. **Install tooling** by running `pnpm install` to set up Turborepo, TypeScript, ESLint, Prettier, Vitest as root devDependencies, plus esbuild for MCP server bundling
4. **Scaffold packages in dependency order** with [packages/shared-types](packages/shared-types), then [packages/api-core](packages/api-core) with `better-sqlite3` as dependency, finally [apps/mcp-server](apps/mcp-server) using `workspace:*` protocol for internal packages, `better-sqlite3` as both devDependency and peerDependency, esbuild config with `--external:better-sqlite3 --bundle --platform=node --banner:js="#!/usr/bin/env node"`, build script with `chmod +x dist/index.js`, and [apps/mcp-server/src/index.ts](apps/mcp-server/src/index.ts) WITHOUT shebang
5. **Create README documentation** in [apps/mcp-server/README.md](apps/mcp-server/README.md) explaining `npx -p better-sqlite3 .` command, Node.js version matching requirement for native binary compatibility, and local development workflow using `pnpm dev` for auto-rebuild on workspace changes

## Further Considerations

1. **Entry point shebang?** Ensure [apps/mcp-server/src/index.ts](apps/mcp-server/src/index.ts) does NOT include shebang (esbuild banner handles it) to avoid double-printing
2. **Turbo watch configuration?** Add `"dev": {"cache": false, "persistent": true}` in [turbo.json](turbo.json) pipeline to enable auto-rebuild when [packages/shared-types](packages/shared-types) or [packages/api-core](packages/api-core) changes
3. **Native module in turbo cache?** Explicitly exclude `node_modules` and `*.node` files from Turbo outputs to prevent caching platform-specific binaries that break cross-platform builds
