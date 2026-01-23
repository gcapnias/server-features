# Node.js Monorepo Structure with Workspaces

In 2026, the gold standard for managing multiple Node.js applications and libraries in a single repository is a **Monorepo** using **Workspaces**. This setup allows you to share code (like validation logic, types, or database models) without the overhead of publishing private npm packages.

## 1. The Recommended Folder Structure

A scalable monorepo separates "apps" (deployable services) from "packages" (internal libraries).

```text
my-monorepo/
├── apps/
│   ├── admin-dashboard/       # Frontend (React/Next.js)
│   ├── main-api/              # Backend (Express/Fastify/NestJS)
│   └── background-worker/     # Independent Node.js service
├── packages/
│   ├── database/              # Shared Prisma/Mongoose schemas
│   ├── ui-components/         # Shared frontend components
│   ├── shared-utils/          # Helpers (date formatting, logging)
│   └── types/                 # Shared TypeScript interfaces
├── .gitignore
├── package.json               # Root config (defines workspaces)
├── turbo.json                 # (Recommended) Build orchestrator config
└── pnpm-workspace.yaml        # (Recommended) Workspace config

```

---

## 2. Choosing Your Tooling

While standard `npm` or `yarn` workspaces work, modern projects typically use a dedicated orchestrator to handle build caching and dependency management.

| Tool | Best For | Why Use It? |
| --- | --- | --- |
| **pnpm** | **Dependency Management** | Efficient disk usage and prevents "phantom dependencies" better than npm. |
| **Turborepo** | **Speed & Simplicity** | Blazing fast. It "remembers" what you've already built or tested and skips it next time. |
| **Nx** | **Enterprise/Complex Repos** | Includes advanced features like code generation and visual dependency graphs. |

---

## 3. Key Implementation Strategies

To make this structure work effectively, follow these three rules:

* **Use Path Aliases:** In your `tsconfig.json`, map your shared packages so you can import them like real modules:
`import { formatDate } from "@my-project/utils";`
* **Hoist Dependencies:** Keep common dev-dependencies (like ESLint, Prettier, or TypeScript) at the **root** `package.json`. Only project-specific dependencies (like `express` or `react`) should live in the sub-folder `package.json`.
* **Scoped Naming:** Prefix your internal packages with a scope (e.g., `@my-org/shared`) to avoid naming collisions with public npm packages.

## 4. Why this works

By using this structure:

1. **Atomicity:** If you update a data model in `packages/database`, you can update the `apps/main-api` and `apps/admin-dashboard` in a single commit.
2. **No "Dependency Hell":** All apps share the same version of shared code instantly.
3. **Deployment:** CI/CD tools can detect which specific app changed and only deploy that service, saving time and money.
