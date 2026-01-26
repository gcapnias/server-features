# Plan: Feature Explorer Console App with Two-Pane Toggle UI

Build `@gcapnias/feature-explorer` at `apps/feature-explorer` with a two-pane blessed TUI: left pane shows a toggleable, scored list (pending/completed via 'p'/'c' keys) with color-coded high-priority items, right pane displays complete scrollable feature details with dependency names resolved via in-memory lookup. Read-only database access with proper session management.

## Steps

1. **Create app package** at [apps/feature-explorer/](apps/feature-explorer/) with [package.json](apps/feature-explorer/package.json) (name: `@gcapnias/feature-explorer`, bin: `feature-explorer`, dependencies: `blessed@^0.1.81`, `@types/blessed@^0.1.25`, workspace packages), [tsconfig.json](apps/feature-explorer/tsconfig.json) with project references, and [vitest.config.ts](apps/vitest.config.ts) following [apps/tasks-mcp-server/](apps/tasks-mcp-server/) patterns

2. **Initialize database and load features** in [src/index.ts](src/index.ts) using `create_database()`, query all features once with `session.query<any>('SELECT * FROM features')` in try-finally block, build in-memory `Map<number, Feature>` for lookups, compute `compute_scheduling_scores()` (returns `Map<number, number>` with scores 0-1110) and `get_blocked_features()` for enriched data, maintain toggle state ('pending'/'completed')

3. **Build two-pane blessed layout** with left `list` widget showing features sorted by scheduling score descending (format: `"Feature Name [850]"` with color coding for scores >800), dynamic title ("Pending Features [N]" or "Completed Features [N]"), right scrollable `box` widget for details with scroll indicators ("↓ More" when content exceeds viewport), bottom status bar with keybindings

4. **Render complete feature details** in right pane showing: header (`ID: N`, `Name`, `Category`), status badges (`✅ Completed`/`🔄 In Progress` with blessed colors), `Priority: N`, multi-line `Description`, numbered `Steps` list, `Dependencies` formatted as `"#1: Feature Name"` using map lookup, `Blocked By` array (if applicable) with same formatting, and `Scheduling Score: 850`

5. **Implement keyboard controls and refresh** with 'p' key toggling to pending list (filter `passes: false`, sort by score), 'c' for completed (`passes: true`, sort by priority), 'r' to re-query database and rebuild all data structures, arrow keys for list navigation, 'q' to quit, updating list title/count/empty state ("No pending features - all done!" or "No completed features yet") on each action

---

**Ready for implementation!** All requirements clarified: abbreviated score format, color-coded high priorities, scroll indicators, read-only database access, and complete feature details with dependency name resolution.
