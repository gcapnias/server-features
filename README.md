# MCP Server Monorepo

A production-ready Node.js monorepo for developing Model Context Protocol (MCP) servers using pnpm workspaces and Turborepo.

## Architecture

This monorepo demonstrates best practices for building MCP servers with proper dependency management and native module handling.

### Package Structure

```text
.
├── packages/
│   ├── shared-types/     # Shared TypeScript type definitions
│   └── api-core/         # Core API with SQLite integration
└── apps/
    └── mcp-server/       # MCP server application (bundled with esbuild)
```

### Dependency Graph

```text
shared-types (foundation)
    ↓
api-core (depends on shared-types, uses better-sqlite3)
    ↓
mcp-server (depends on api-core and shared-types)
```

## Prerequisites

- **Node.js**: >=20.0.0
- **pnpm**: >=9.0.0

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

This will:

- Install all workspace dependencies
- Link workspace packages using `workspace:*` protocol
- Set up native modules (better-sqlite3)

### 2. Build All Packages

```bash
pnpm build
```

Turborepo will build packages in the correct order based on dependencies.

### 3. Development Mode

```bash
pnpm dev
```

This runs Turborepo in watch mode with auto-rebuild on file changes across all workspace packages.

## Scripts

### Root Scripts

- `pnpm build` - Build all packages in dependency order
- `pnpm dev` - Run all packages in watch mode
- `pnpm test` - Run tests across all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm outdated` - Check for outdated packages across workspace
- `pnpm audit` - Run security audit
- `pnpm update` - Interactively update packages

## Configuration Files

### Workspace Configuration

- [pnpm-workspace.yaml](pnpm-workspace.yaml) - Defines workspace packages
- [.npmrc](.npmrc) - pnpm configuration with strict engine checking
- [package.json](package.json) - Root package with `packageManager` field

### Build Pipeline

- [turbo.json](turbo.json) - Turborepo pipeline configuration
  - `build`: Caches outputs, depends on upstream builds
  - `dev`: No cache, persistent tasks for watch mode

### TypeScript

- [tsconfig.json](tsconfig.json) - Solution-style configuration with project references
- Each package has its own `tsconfig.json` with `composite: true`

### Code Quality

- [.eslintrc.json](.eslintrc.json) - ESLint with TypeScript support
- [.prettierrc.json](.prettierrc.json) - Prettier configuration
- [.editorconfig](.editorconfig) - Editor settings

## Native Modules (better-sqlite3)

This monorepo handles `better-sqlite3` as a native module:

1. **api-core**: Imports and uses better-sqlite3
2. **mcp-server**: Declares as peerDependency and external in esbuild
3. **Build**: esbuild excludes better-sqlite3 from bundle
4. **Runtime**: Must be available in execution context

See [apps/mcp-server/README.md](apps/mcp-server/README.md) for usage details.

## Key Design Decisions

### 1. Workspace Protocol

All internal dependencies use `workspace:*` for automatic linking:

```json
{
  "dependencies": {
    "@myapp/shared-types": "workspace:*"
  }
}
```

### 2. TypeScript Project References

Enables incremental builds and better editor integration:

```json
{
  "references": [{ "path": "../shared-types" }]
}
```

### 3. Turborepo Pipeline

Optimizes build order and caching:

```json
{
  "build": {
    "dependsOn": ["^build"] // Wait for dependencies
  }
}
```

### 4. Native Module Externalization

`better-sqlite3` is never bundled to ensure platform compatibility:

```bash
esbuild --bundle --external:better-sqlite3
```

## Adding New Packages

### Internal Package

```bash
mkdir -p packages/new-package/src
cd packages/new-package

# Create package.json
cat > package.json << EOF
{
  "name": "@myapp/new-package",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "@myapp/shared-types": "workspace:*"
  }
}
EOF

# Install from root
cd ../..
pnpm install
```

### Application

Same as above, but place in `apps/` directory.

## Troubleshooting

### pnpm Not Found

Install pnpm globally:

```bash
npm install -g pnpm@9.0.0
```

Or enable Corepack (requires admin/sudo):

```bash
corepack enable
```

### Workspace Dependency Not Found

Ensure:

1. Package is listed in [pnpm-workspace.yaml](pnpm-workspace.yaml)
2. Package has correct `name` field in package.json
3. Run `pnpm install` from root

### Build Fails

Try:

```bash
# Clean all builds
pnpm turbo run clean

# Rebuild
pnpm build
```

### Native Module Errors

Reinstall with matching Node.js version:

```bash
pnpm install --force
```

## Learn More

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [esbuild](https://esbuild.github.io/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
