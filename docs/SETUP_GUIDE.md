# Node.js Monorepo Initialization Guide

A comprehensive step-by-step guide for initializing a production-ready Node.js monorepo using pnpm workspaces and Turborepo for MCP server development.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Environment Setup](#step-1-environment-setup)
3. [Step 2: Workspace Foundation](#step-2-workspace-foundation)
4. [Step 3: Build Pipeline & Code Quality](#step-3-build-pipeline--code-quality)
5. [Step 4: Install Tooling](#step-4-install-tooling)
6. [Step 5: Scaffold Packages](#step-5-scaffold-packages)
7. [Step 6: Documentation](#step-6-documentation)
8. [Step 7: Build & Verify](#step-7-build--verify)
9. [Key Concepts](#key-concepts)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** >=20.0.0 ([download](https://nodejs.org/))
- **pnpm** >=9.0.0 (install with `npm install -g pnpm@9.0.0`)
- **Git** installed and configured

Verify your setup:

```bash
node --version  # Should be >= 20.0.0
pnpm --version  # Should be >= 9.0.0
```

---

## Step 1: Environment Setup

### 1.1 Create Project Directory

```bash
mkdir my-monorepo
cd my-monorepo
```

### 1.2 Initialize Git Repository

```bash
git init
```

### 1.3 Create .gitignore (IMPORTANT: Do this BEFORE installing packages)

Create `.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
*.tsbuildinfo

# Turborepo
.turbo/

# Testing
coverage/
*.lcov

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Native modules
*.node
```

---

## Step 2: Workspace Foundation

### 2.1 Create pnpm Workspace Configuration

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

This tells pnpm where to find workspace packages.

### 2.2 Create .npmrc Configuration

Create `.npmrc`:

```ini
engine-strict=true
link-workspace-packages=true
shared-workspace-lockfile=true
save-exact=true
```

**What these do:**

- `engine-strict=true` - Enforces Node.js version requirements
- `link-workspace-packages=true` - Automatically links workspace dependencies
- `shared-workspace-lockfile=true` - Uses single lockfile for entire workspace
- `save-exact=true` - Pins exact dependency versions

### 2.3 Create Root package.json

Create `package.json`:

```json
{
  "name": "mcp-server-monorepo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
  },
  "devDependencies": {}
}
```

**Key fields:**

- `private: true` - Prevents accidental publishing
- `packageManager` - Specifies exact pnpm version (used by Corepack)
- `engines` - Enforces minimum Node.js/pnpm versions

---

## Step 3: Build Pipeline & Code Quality

### 3.1 Create Turborepo Configuration

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "!node_modules/**", "!**/*.node"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Pipeline explanations:**

- `"dependsOn": ["^build"]` - Wait for upstream package builds
- `"outputs": ["dist/**"]` - Files to cache on successful build
- `"cache": false` - Don't cache dev tasks (always run fresh)
- `"persistent": true` - Long-running process (watch mode)
- `"!**/*.node"` - Exclude native modules from cache

### 3.2 Create Root TypeScript Configuration

Create `tsconfig.json` (solution-style):

```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared-types" },
    { "path": "./packages/api-core" },
    { "path": "./apps/mcp-server" }
  ]
}
```

This enables TypeScript project references for incremental builds.

### 3.3 Create ESLint Configuration

Create `.eslintrc.json`:

```json
{
  "env": {
    "node": true,
    "es2022": true
  },
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "ignorePatterns": ["dist", "node_modules", "*.config.js"]
}
```

### 3.4 Create Prettier Configuration

Create `.prettierrc.json`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 3.5 Create EditorConfig

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

## Step 4: Install Tooling

Install root development dependencies:

```bash
pnpm add -D -w turbo typescript @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint prettier vitest esbuild
```

**Flags explained:**

- `-D` - Install as devDependencies
- `-w` (or `--workspace-root`) - Install at workspace root

**Expected output:**

```text
devDependencies:
+ @typescript-eslint/eslint-plugin
+ @typescript-eslint/parser
+ esbuild
+ eslint
+ prettier
+ turbo
+ typescript
+ vitest
```

---

## Step 5: Scaffold Packages

### 5.1 Create packages/shared-types

#### package.json

```bash
mkdir -p packages/shared-types/src
```

Create `packages/shared-types/package.json`:

```json
{
  "name": "@myapp/shared-types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "dev": "tsc --build --watch",
    "clean": "tsc --build --clean"
  }
}
```

#### tsconfig.json

Create `packages/shared-types/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key settings:**

- `"composite": true` - **Required** for project references
- `"declaration": true` - Generate .d.ts files
- `"declarationMap": true` - Enable go-to-definition across packages

#### Source Code

Create `packages/shared-types/src/index.ts`:

```typescript
/**
 * Shared type definitions for the MCP server monorepo
 */

export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
}

export interface ServerConfig {
  name: string;
  version: string;
  database: DatabaseConfig;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

### 5.2 Create packages/api-core

#### package.json

```bash
mkdir -p packages/api-core/src
```

Create `packages/api-core/package.json`:

```json
{
  "name": "@myapp/api-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "dev": "tsc --build --watch",
    "clean": "tsc --build --clean",
    "test": "vitest"
  },
  "dependencies": {
    "@myapp/shared-types": "workspace:*",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12"
  }
}
```

**Important:**

- `"@myapp/shared-types": "workspace:*"` - Links to workspace package
- `"better-sqlite3": "^11.0.0"` - Native module dependency

#### tsconfig.json

Create `packages/api-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": [{ "path": "../shared-types" }]
}
```

**Note:** `"references"` array points to shared-types for dependency tracking.

#### Source Code

Create `packages/api-core/src/index.ts`:

```typescript
import Database from 'better-sqlite3';
import type { DatabaseConfig, ApiResponse } from '@myapp/shared-types';

/**
 * Core API functionality with SQLite database integration
 */
export class DatabaseService {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path, {
      verbose: config.verbose ? console.log : undefined,
    });

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Initialize database schema
   */
  initialize(): ApiResponse {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all items from database
   */
  getItems(): ApiResponse<Array<{ id: number; name: string; created_at: number }>> {
    try {
      const stmt = this.db.prepare('SELECT * FROM items ORDER BY created_at DESC');
      const data = stmt.all() as Array<{ id: number; name: string; created_at: number }>;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add a new item to the database
   */
  addItem(name: string): ApiResponse<{ id: number }> {
    try {
      const stmt = this.db.prepare('INSERT INTO items (name) VALUES (?)');
      const info = stmt.run(name);
      return { success: true, data: { id: Number(info.lastInsertRowid) } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
```

---

### 5.3 Create apps/mcp-server

#### package.json

```bash
mkdir -p apps/mcp-server/src
```

Create `apps/mcp-server/package.json`:

```json
{
  "name": "@myapp/mcp-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": {
    "mcp-server": "./dist/index.js"
  },
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --external:better-sqlite3 --banner:js=\"#!/usr/bin/env node\" --outfile=dist/index.js && node -e \"require('fs').chmodSync('dist/index.js', 0o755)\"",
    "dev": "pnpm build --watch",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@myapp/api-core": "workspace:*",
    "@myapp/shared-types": "workspace:*"
  },
  "peerDependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "better-sqlite3": "^11.0.0"
  }
}
```

**Critical build script breakdown:**

```bash
esbuild src/index.ts \
  --bundle \                              # Bundle all dependencies
  --platform=node \                       # Target Node.js runtime
  --external:better-sqlite3 \             # DON'T bundle native module
  --banner:js="#!/usr/bin/env node" \     # Add shebang to output
  --outfile=dist/index.js \               # Output file
  && chmod +x dist/index.js               # Make executable (Unix)
```

**Dependency strategy:**

- `peerDependencies` - Document runtime requirement
- `devDependencies` - Available during development (may fail to compile)

#### tsconfig.json

Create `apps/mcp-server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": [{ "path": "../../packages/shared-types" }, { "path": "../../packages/api-core" }]
}
```

#### Source Code

Create `apps/mcp-server/src/index.ts` (NO shebang - esbuild adds it):

```typescript
import { DatabaseService } from '@myapp/api-core';
import type { ServerConfig } from '@myapp/shared-types';

const config: ServerConfig = {
  name: 'MCP Server',
  version: '0.0.0',
  database: {
    path: './data.db',
    verbose: process.env.NODE_ENV === 'development',
  },
};

console.log(`Starting ${config.name} v${config.version}...`);

const db = new DatabaseService(config.database);

// Initialize database
const initResult = db.initialize();
if (!initResult.success) {
  console.error('Failed to initialize database:', initResult.error);
  process.exit(1);
}

console.log('Database initialized successfully');

// Example usage
const addResult = db.addItem('Test Item');
if (addResult.success) {
  console.log('Added item with ID:', addResult.data?.id);
}

const itemsResult = db.getItems();
if (itemsResult.success) {
  console.log('Current items:', itemsResult.data);
}

db.close();
console.log('Server completed successfully');
```

**Important:** DO NOT include `#!/usr/bin/env node` at the top - esbuild's `--banner` flag adds it.

---

## Step 6: Documentation

### 6.1 Create MCP Server README

Create `apps/mcp-server/README.md`:

````markdown
# MCP Server

A Model Context Protocol (MCP) server built with TypeScript and SQLite.

## Prerequisites

- **Node.js**: >=20.0.0 (required for native module compatibility)
- **pnpm**: >=9.0.0

## Running

### Important: better-sqlite3 Compatibility

The `better-sqlite3` package is a **native module** that must match your Node.js version. Always run the server using:

```bash
npx -p better-sqlite3 .
```
````

The `-p` flag ensures `better-sqlite3` is available with the correct native bindings for your current Node.js version.

## Development

From monorepo root:

```bash
pnpm dev
```

This uses Turborepo's watch mode to automatically rebuild the MCP server when any workspace dependency changes.

### 6.2 Create Root README

Create `README.md` at project root with complete monorepo documentation (see full example in repository).

---

## Step 7: Build & Verify

### 7.1 Install All Dependencies

```bash
# Use --ignore-scripts if better-sqlite3 compilation fails
# (it will be installed at runtime via npx)
pnpm install --ignore-scripts
```

### 7.2 Build All Packages

```bash
pnpm build
```

**Expected output:**

```text
• Packages in scope: @myapp/api-core, @myapp/mcp-server, @myapp/shared-types
• Running build in 3 packages
@myapp/shared-types:build: cache miss, executing
@myapp/api-core:build: cache miss, executing
@myapp/mcp-server:build: cache miss, executing

Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
Time:    4.632s
```

### 7.3 Verify Structure

```bash
tree -L 3 -I node_modules
```

**Expected structure:**

```text
.
├── .gitignore
├── .npmrc
├── .editorconfig
├── .eslintrc.json
├── .prettierrc.json
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.json
├── turbo.json
├── README.md
├── packages/
│   ├── shared-types/
│   │   ├── dist/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api-core/
│       ├── dist/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
└── apps/
    └── mcp-server/
        ├── dist/
        ├── src/
        ├── package.json
        ├── tsconfig.json
        └── README.md
```

---

## Key Concepts

### Workspace Protocol (`workspace:*`)

The `workspace:*` protocol ensures dependencies are always linked from the workspace:

```json
{
  "dependencies": {
    "@myapp/shared-types": "workspace:*"
  }
}
```

**Benefits:**

- Always uses latest local version
- No need to republish for local development
- Transformed to actual versions when publishing

### TypeScript Project References

Project references enable:

- **Incremental builds** (only rebuild changed projects)
- **Better editor support** (go-to-definition across packages)
- **Enforced architecture** (circular dependency prevention)

**Requirements:**

- `"composite": true` in each package
- `"references": [...]` array pointing to dependencies
- Root tsconfig.json as "solution"

### Turborepo Pipeline

Turborepo optimizes builds by:

- **Dependency ordering** (`"dependsOn": ["^build"]`)
- **Intelligent caching** (skip unchanged packages)
- **Parallel execution** (build independent packages simultaneously)

**Task types:**

- **Build tasks**: Cacheable, outputs specified
- **Dev tasks**: Not cached (`cache: false`), long-running (`persistent: true`)

### Native Module Handling (better-sqlite3)

Native modules require special handling:

1. **Never bundle** - Always mark as `--external` in esbuild
2. **Peer dependency** - Document runtime requirement
3. **Platform-specific** - Must match Node.js version
4. **Runtime installation** - Use `npx -p better-sqlite3` for compatibility

**Why this matters:**

- Native modules are compiled for specific Node.js versions
- Bundling breaks native bindings
- Cross-platform development requires runtime installation

---

## Troubleshooting

### "pnpm: command not found"

Install pnpm globally:

```bash
npm install -g pnpm@9.0.0
```

### "Running this command will add the dependency to the workspace root"

Use `-w` flag for root dependencies:

```bash
pnpm add -D -w turbo
```

### better-sqlite3 Installation Fails

This is expected if Python isn't installed. Use `--ignore-scripts`:

```bash
pnpm install --ignore-scripts
```

The native module will be installed at runtime via `npx -p better-sqlite3`.

### Workspace Package Not Found

Ensure:

1. Package listed in `pnpm-workspace.yaml`
2. Correct `name` field in package.json
3. Run `pnpm install` from root

### Build Fails with TypeScript Errors

Check:

1. All packages have `"composite": true`
2. References point to correct paths
3. Root tsconfig.json includes all packages

Clean and rebuild:

```bash
pnpm turbo run clean
pnpm build
```

### Turborepo Cache Issues

Clear cache and rebuild:

```bash
rm -rf .turbo
pnpm build
```

### "Module did not self-register" Error

Node.js version mismatch. Reinstall native modules:

```bash
pnpm install --force
# or
npx -p better-sqlite3 .
```

---

## Next Steps

1. **Add Testing**
   - Configure Vitest for each package
   - Add `test` scripts to package.json
   - Run with `pnpm test`

2. **Add Linting**
   - Add `lint` scripts to each package
   - Configure ESLint rules per package
   - Run with `pnpm lint`

3. **CI/CD Setup**
   - Configure GitHub Actions / GitLab CI
   - Use Turborepo remote caching
   - Automate builds and tests

4. **Development Workflow**
   - Use `pnpm dev` for watch mode
   - Test MCP server with `npx -p better-sqlite3 .`
   - Commit frequently with conventional commits

---

## Summary

You now have a production-ready Node.js monorepo with:

✅ pnpm workspaces for package management  
✅ Turborepo for optimized builds  
✅ TypeScript project references for incremental compilation  
✅ Proper native module handling (better-sqlite3)  
✅ Code quality tools (ESLint, Prettier)  
✅ Comprehensive documentation

**Key commands:**

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm dev              # Watch mode
pnpm test             # Run tests
pnpm lint             # Lint code
pnpm outdated         # Check for outdated packages
pnpm audit            # Run security audit
pnpm update           # Update packages interactively
```

Happy coding! 🚀
