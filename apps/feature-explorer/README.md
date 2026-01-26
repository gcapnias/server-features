# @gcapnias/feature-explorer

A two-pane terminal UI for exploring features with toggleable pending/completed views, dependency resolution, and scheduling scores.

## Features

- 🎨 **Borland IDE Color Scheme** - Classic "Blue Screen" aesthetic with navy blue background, cyan borders, and yellow highlights
- 🖥️ **Two-Pane Layout** - Left list with sorted features, right pane with full details
- 🔄 **Toggle Views** - Switch between pending/completed features with 'p'/'c' keys
- 🎯 **Smart Sorting** - Pending by scheduling score, completed by priority
- 🌈 **Color-Coded** - High-priority items (score >800) highlighted in bright yellow
- 📊 **Full Details** - Status, dependencies, steps, and blocking info
- 🔍 **Read-Only** - Safe database access with proper session management
- ⚡ **Live Refresh** - Re-query database with 'r' key

## Color Scheme

The application features a classic **Borland C++/Turbo Pascal IDE** aesthetic:

- **Background**: Deep navy blue (high-contrast, easy on the eyes)
- **Text**: White and light gray for maximum readability
- **Keywords/Labels**: Bright yellow (field names, section headers)
- **Borders**: Cyan borders with bold styling
- **Selection**: Cyan background with black text
- **Comments/Dependencies**: Cyan text
- **Errors/Blockers**: Red text
- **Success/Completed**: Green text
- **Status Bar**: Light gray background with black text

This vintage color scheme provides excellent readability on modern displays while evoking the nostalgic, distraction-free productivity of the DOS era.

## Prerequisites

- Node.js 18+
- Project database initialized at `~/.config/gcapnias/feature_tracker/tasks.db`

## Installation

From monorepo root:

```bash
pnpm install
pnpm --filter @gcapnias/feature-explorer build
```

## Usage

Run the explorer:

```bash
# From monorepo root
pnpm --filter @gcapnias/feature-explorer start

# Or using the bin
./apps/feature-explorer/dist/index.js

# Or if installed globally
feature-explorer
```

## Keyboard Controls

```text
↑/↓ - Navigate feature list
- `p` - Show pending features (sorted by scheduling score)
- `c` - Show completed features (sorted by priority)
- `r` - Refresh from database
- `q` / `Esc` - Quit

## Layout

```

┌─ Pending Features [5] ───────┬─ Feature Details ─────────┐
│ Authentication System [950] │ ID: 3 │
│ Database Schema [850] │ Name: Authentication Sys │
│ User Profile [720] │ Category: core │
│ Email Service [650] │ │
│ ... │ ✅ Completed │
│ │ Priority: 10 │
│ │ │
│ │ Description: │
│ │ Implement secure auth... │
│ │ │
│ │ Steps: │
│ │ 1. Design schema │
│ │ 2. Create endpoints │
│ │ 3. Add tests │
│ │ │
│ │ Dependencies: │
│ │ #1: Database Setup │
│ │ #2: Config System │
│ │ │
│ │ Scheduling Score: 950 │
│ │ ↓ More │
└──────────────────────────────┴───────────────────────────┘
[p]ending [c]ompleted [r]efresh [q]uit

````

## Implementation

Built following the [Explorer Implementation Plan](../../docs/Explorer_Implementation_Plan.md) using:

- **blessed** - Terminal UI framework
- **@gcapnias/api-core** - Database access and dependency resolution
- **@gcapnias/shared-types** - Type definitions

## Development

```bash
# Watch mode
pnpm --filter @gcapnias/feature-explorer dev

# Run tests
pnpm --filter @gcapnias/feature-explorer test

# Type check
pnpm typecheck
````
