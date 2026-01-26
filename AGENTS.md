# AGENTS.md

## Planning Mode Protocols

- **Skill Prioritization:** Whenever the agent is in **Planning Mode**, it must prioritize the use of the `documentation-lookup` skill before proposing an architecture or implementation strategy.
- **Objective:** Ensure all technical recommendations are grounded in the latest documentation to minimize hallucinations and technical debt.
- **Trigger:** If the user request involves "how-to," "architecture," "setup," or "integration," initiate `documentation-lookup` for the relevant libraries/frameworks involved.

---

## Solution Structure

```text
autocoder-playground/
├── packages/                     # Shared workspace packages
│   ├── shared-types/             # TypeScript type definitions (DatabaseConfig, ApiResponse, ServerConfig)
│   │   ├── src/
│   │   └── dist/                 # Compiled output
│   │
│   └── api-core/                 # Core database API with SQLite integration (DatabaseService)
│       ├── src/
│       └── dist/                 # Compiled output
│
├── apps/                         # Application packages
│   ├── tasks-mcp-server/         # MCP server application (bundled with esbuild)
│   │   ├── src/
│   │   └── dist/                 # Bundled executable
│   │
│   └── feature-explorer/         # Terminal UI for exploring features
│       ├── src/
│       └── dist/                 # Compiled output
│
├── docs/                         # Comprehensive documentation
│   ├── SETUP_GUIDE.md            # Step-by-step initialization guide
│   ├── IMPLEMENTATION_SUMMARY.md # Implementation overview
│   ├── INITIALIZATION_PLAN.md    # Original planning document
│   └── QUICK_REFERENCE.md        # Command reference
│
├── .github/                      # GitHub workflows, prompts, and skills
│
├── package.json                  # Root package with workspace scripts
├── pnpm-workspace.yaml           # Workspace package definitions
├── turbo.json                    # Turborepo build pipeline configuration
└── tsconfig.json                 # TypeScript solution configuration
```

**Dependency Flow:** `shared-types` → `api-core` → `tasks-mcp-server` | `feature-explorer`

**Key Directories:**

- **`packages/`** - Reusable packages that can be imported by applications
- **`apps/`** - Deployable applications that consume workspace packages
- **`docs/`** - All project documentation and guides

---

## Documentation Files

### Root Documentation

- **[README.md](README.md)** - Main project documentation covering monorepo architecture, package structure, configuration, and usage instructions

### Setup & Implementation Guides

- **[docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** - Comprehensive 300+ line step-by-step guide for initializing the monorepo from scratch, including all library documentation references
- **[docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)** - Summary of completed implementation with build verification, configuration highlights, and success criteria
- **[docs/INITIALIZATION_PLAN.md](docs/INITIALIZATION_PLAN.md)** - Original plan document outlining the monorepo initialization strategy
- **[docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Command reference guide with common patterns, troubleshooting tips, and configuration snippets

### Application & Packages Documentation

- **[apps/tasks-mcp-server/README.md](apps/tasks-mcp-server/README.md)** - MCP server application documentation covering prerequisites, running instructions, and native module compatibility
- **[apps/feature-explorer/README.md](apps/feature-explorer/README.md)** - Terminal UI application documentation with keyboard controls, layout details, and usage instructions
- **[packages/api-core/README.md](packages/api-core/README.md)** - Core API package documentation with DatabaseService API reference, usage examples, and best practices

---

## Development Workflow

### 🛠 Dependency & Environment Management

- **Rule**: DO NOT modify `package.json` or lockfiles directly.
- **Detection**: Before running any command, identify the correct package manager by checking for these lockfiles in the root:
  - `pnpm-lock.yaml` -> Use **pnpm**
  - `yarn.lock` -> Use **yarn**
  - `package-lock.json` -> Use **npm**
- **Constraint**: Always use the detected tool's CLI to manage dependencies to ensure lockfiles remain synchronized.

### 🏗 Build & Verification Commands

Use the detected package manager to run these standard scripts:

- **Build**: `[pm] run build`
- **Type Check**: `[pm] run typecheck`
- **Lint**: `[pm] run lint`
- **Test**: `[pm] test` (or `[pm] run test`)

### 🧪 Targeted Testing

When possible, run specific tests instead of the full suite for speed:

- **npm/pnpm**: `[pm] test -- -t "pattern"`
- **yarn**: `yarn test -t "pattern"`
