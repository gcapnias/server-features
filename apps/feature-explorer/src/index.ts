/**
 * Feature Explorer - Two-Pane Terminal UI
 * ========================================
 *
 * Interactive blessed TUI for exploring features with:
 * - Left pane: toggleable pending/completed list with scores
 * - Right pane: scrollable full feature details with dependencies
 * - Keyboard controls: p/c toggle, r refresh, arrows navigate
 */

import * as blessed from 'blessed';
import {
  create_database,
  get_database_path,
  Feature,
  compute_scheduling_scores,
  get_blocked_features,
} from '@gcapnias/api-core';
import type { Feature as IFeature } from '@gcapnias/shared-types';

// App state
interface AppState {
  features: Map<number, IFeature>;
  scores: Map<number, number>;
  blockedMap: Map<number, number[]>;
  currentView: 'pending' | 'completed';
  selectedIndex: number;
}

// Initialize state
const state: AppState = {
  features: new Map(),
  scores: new Map(),
  blockedMap: new Map(),
  currentView: 'pending',
  selectedIndex: 0,
};

/**
 * Load all features from database
 */
function loadFeatures(): void {
  const db_path = get_database_path();
  const { session_maker } = create_database(db_path);
  const session = session_maker();

  try {
    // Query all features
    const rows = session.query<any>('SELECT * FROM features');

    // Build feature map
    state.features.clear();
    for (const row of rows) {
      const feature: IFeature = {
        id: row.id,
        priority: row.priority,
        category: row.category,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps || '[]'),
        passes: Boolean(row.passes),
        in_progress: Boolean(row.in_progress),
        dependencies: JSON.parse(row.dependencies || 'null'),
      };
      state.features.set(feature.id, feature);
    }

    // Compute scores and blocked features
    const featureArray = Array.from(state.features.values());
    state.scores = compute_scheduling_scores(featureArray);

    const blocked = get_blocked_features(featureArray);
    state.blockedMap.clear();
    for (const b of blocked) {
      state.blockedMap.set(b.id, b.blocked_by);
    }
  } finally {
    session.close();
  }
}

/**
 * Get features for current view
 */
function getCurrentFeatures(): IFeature[] {
  const features = Array.from(state.features.values());

  if (state.currentView === 'pending') {
    // Filter: not passing
    const pending = features.filter((f) => !f.passes);
    // Sort by scheduling score descending
    return pending.sort((a, b) => (state.scores.get(b.id) || 0) - (state.scores.get(a.id) || 0));
  } else {
    // Filter: passing
    const completed = features.filter((f) => f.passes);
    // Sort by priority ascending, then id
    return completed.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.id - b.id;
    });
  }
}

/**
 * Format feature for list display with Borland-style colors
 */
function formatListItem(feature: IFeature): string {
  const score = state.scores.get(feature.id) || 0;
  const scoreStr = Math.round(score).toString();

  // Color code high priority (score > 800) in bright yellow (keyword color)
  if (state.currentView === 'pending' && score > 800) {
    return `{yellow-fg}{bold}${feature.name}{/bold} {white-fg}[${scoreStr}]{/white-fg}{/yellow-fg}`;
  }

  // Regular items in white
  return `{white-fg}${feature.name}{/white-fg} {gray-fg}[${scoreStr}]{/gray-fg}`;
}

/**
 * Render feature details in right pane with Borland-style colors
 */
function renderDetails(feature: IFeature | null): string {
  if (!feature) {
    return '{center}{gray-fg}Select a feature to view details{/gray-fg}{/center}';
  }

  const lines: string[] = [];

  // Header with yellow labels (keyword style)
  lines.push(`{yellow-fg}{bold}ID:{/bold}{/yellow-fg} {white-fg}${feature.id}{/white-fg}`);
  lines.push(`{yellow-fg}{bold}Name:{/bold}{/yellow-fg} {white-fg}${feature.name}{/white-fg}`);
  lines.push(
    `{yellow-fg}{bold}Category:{/bold}{/yellow-fg} {white-fg}${feature.category}{/white-fg}`
  );
  lines.push('');

  // Status badge with Borland colors
  if (feature.passes) {
    lines.push('{green-fg}{bold}✅ Completed{/bold}{/green-fg}');
  } else if (feature.in_progress) {
    lines.push('{yellow-fg}{bold}🔄 In Progress{/bold}{/yellow-fg}');
  } else {
    lines.push('{white-fg}⏸ Pending{/white-fg}');
  }

  lines.push('');
  lines.push(
    `{yellow-fg}{bold}Priority:{/bold}{/yellow-fg} {white-fg}${feature.priority}{/white-fg}`
  );
  lines.push('');

  // Description (white text like comments in cyan area)
  lines.push(`{yellow-fg}{bold}Description:{/bold}{/yellow-fg}`);
  lines.push(`{white-fg}${feature.description}{/white-fg}`);
  lines.push('');

  // Steps
  if (feature.steps && feature.steps.length > 0) {
    lines.push(`{yellow-fg}{bold}Steps:{/bold}{/yellow-fg}`);
    feature.steps.forEach((step, idx) => {
      lines.push(`  {cyan-fg}${idx + 1}.{/cyan-fg} {white-fg}${step}{/white-fg}`);
    });
    lines.push('');
  }

  // Dependencies in cyan (like comments)
  const deps = feature.dependencies || [];
  if (deps.length > 0) {
    lines.push(`{yellow-fg}{bold}Dependencies:{/bold}{/yellow-fg}`);
    deps.forEach((depId) => {
      const depFeature = state.features.get(depId);
      const depName = depFeature ? depFeature.name : 'Unknown';
      lines.push(
        `  {cyan-fg}#{/cyan-fg}{white-fg}${depId}{/white-fg}{cyan-fg}:{/cyan-fg} {white-fg}${depName}{/white-fg}`
      );
    });
    lines.push('');
  }

  // Blocked by in red (error color)
  const blockedBy = state.blockedMap.get(feature.id);
  if (blockedBy && blockedBy.length > 0) {
    lines.push(`{red-fg}{bold}Blocked By:{/bold}{/red-fg}`);
    blockedBy.forEach((blockId) => {
      const blockFeature = state.features.get(blockId);
      const blockName = blockFeature ? blockFeature.name : 'Unknown';
      lines.push(
        `  {red-fg}#{/red-fg}{white-fg}${blockId}{/white-fg}{red-fg}:{/red-fg} {white-fg}${blockName}{/white-fg}`
      );
    });
    lines.push('');
  }

  // Scheduling score with yellow label
  const score = state.scores.get(feature.id) || 0;
  lines.push(
    `{yellow-fg}{bold}Scheduling Score:{/bold}{/yellow-fg} {white-fg}${Math.round(score)}{/white-fg}`
  );

  return lines.join('\n');
}

/**
 * Main application
 */
function main(): void {
  // Load initial data
  loadFeatures();

  // Create screen with Borland-style navy blue background
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Feature Explorer',
    fullUnicode: true,
    style: {
      bg: 'blue',
      fg: 'white',
    },
  });

  // Left list pane with Borland-style colors
  const list = blessed.list({
    parent: screen,
    top: 0,
    left: 0,
    width: '50%',
    height: '100%-1',
    border: { type: 'line' },
    style: {
      fg: 'white',
      bg: 'blue',
      border: { fg: 'cyan', bold: true },
      selected: {
        bg: 'cyan',
        fg: 'black',
        bold: true,
      },
      label: {
        fg: 'yellow',
        bold: true,
      },
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollbar: {
      ch: '█',
      style: {
        bg: 'cyan',
        fg: 'blue',
      },
    },
  });

  // Right details pane with Borland-style colors
  const detailsBox = blessed.box({
    parent: screen,
    top: 0,
    left: '50%',
    width: '50%',
    height: '100%-1',
    border: { type: 'line' },
    label: ' Feature Details ',
    style: {
      fg: 'white',
      bg: 'blue',
      border: { fg: 'cyan', bold: true },
      label: {
        fg: 'yellow',
        bold: true,
      },
    },
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: '█',
      style: {
        bg: 'cyan',
        fg: 'blue',
      },
    },
    keys: true,
    vi: true,
    mouse: true,
  });

  // Status bar with Borland-style light gray background
  const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content:
      '{black-fg}[{/black-fg}{blue-fg}p{/blue-fg}{black-fg}]ending [{/black-fg}{blue-fg}c{/blue-fg}{black-fg}]ompleted [{/black-fg}{blue-fg}r{/blue-fg}{black-fg}]efresh [{/black-fg}{blue-fg}q{/blue-fg}{black-fg}]uit{/black-fg}',
    style: {
      fg: 'black',
      bg: 'lightgray',
    },
    tags: true,
  });

  /**
   * Update list display
   */
  function updateList(): void {
    const features = getCurrentFeatures();
    const count = features.length;

    // Update title
    const viewName = state.currentView === 'pending' ? 'Pending' : 'Completed';
    list.setLabel(` ${viewName} Features [${count}] `);

    // Populate items
    if (count === 0) {
      const emptyMsg =
        state.currentView === 'pending'
          ? '{center}{green-fg}No pending features - all done!{/green-fg}{/center}'
          : '{center}{gray-fg}No completed features yet{/gray-fg}{/center}';
      list.setItems([emptyMsg]);
    } else {
      const items = features.map(formatListItem);
      list.setItems(items);
    }

    // Reset selection
    if (state.selectedIndex >= count) {
      state.selectedIndex = Math.max(0, count - 1);
    }
    list.select(state.selectedIndex);

    updateDetails();
    screen.render();
  }

  /**
   * Update details pane
   */
  function updateDetails(): void {
    const features = getCurrentFeatures();
    const selectedFeature = features[state.selectedIndex] || null;

    const content = renderDetails(selectedFeature);
    detailsBox.setContent(content);

    // Reset scroll position
    detailsBox.setScrollPerc(0);

    // Check if content is scrollable
    const contentHeight = content.split('\n').length;
    const viewportHeight = (detailsBox.height as number) - 2; // Account for border
    if (contentHeight > viewportHeight) {
      // Add scroll indicator at bottom with Borland-style cyan color
      const currentContent = detailsBox.getContent();
      if (!currentContent.includes('↓ More')) {
        detailsBox.setContent(currentContent + '\n{center}{cyan-fg}↓ More{/cyan-fg}{/center}');
      }
    }
  }

  // Event: List selection changed
  list.on('select', (_item, index) => {
    state.selectedIndex = index;
    updateDetails();
    screen.render();
  });

  // Key: Toggle to pending
  screen.key(['p', 'P'], () => {
    if (state.currentView !== 'pending') {
      state.currentView = 'pending';
      state.selectedIndex = 0;
      updateList();
    }
  });

  // Key: Toggle to completed
  screen.key(['c', 'C'], () => {
    if (state.currentView !== 'completed') {
      state.currentView = 'completed';
      state.selectedIndex = 0;
      updateList();
    }
  });

  // Key: Refresh from database
  screen.key(['r', 'R'], () => {
    loadFeatures();
    state.selectedIndex = 0;
    updateList();
  });

  // Key: Quit
  screen.key(['q', 'Q', 'escape', 'C-c'], () => {
    return process.exit(0);
  });

  // Focus list
  list.focus();

  // Initial render
  updateList();
  screen.render();
}

// Run application
main();
