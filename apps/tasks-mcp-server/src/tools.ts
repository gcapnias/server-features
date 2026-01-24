/**
 * MCP Tool Functions for Feature Management
 *
 * Implements all 18 tools from Python feature_mcp.py with identical names
 * and original Python documentation preserved as comments.
 */

import type { Feature } from '@gcapnias/shared-types';
import {
  create_database,
  compute_scheduling_scores,
  would_create_circular_dependency,
  MAX_DEPENDENCIES,
  migrate_json_to_sqlite,
} from '@gcapnias/api-core';
import { lockPriority, unlockPriority } from './tools-utils';

// Global database references (initialized on startup)
let _session_maker: ReturnType<typeof create_database>['session_maker'] | null = null;
let _engine: ReturnType<typeof create_database>['engine'] | null = null;

/**
 * Initialize the database connection
 */
export function initializeDatabase(dbPath: string): void {
  const { engine, session_maker } = create_database(dbPath);
  _engine = engine;
  _session_maker = session_maker;

  // Run migration if needed
  const projectDir = process.cwd();
  migrate_json_to_sqlite(projectDir, session_maker);
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (_engine) {
    _engine.close();
    _engine = null;
    _session_maker = null;
  }
}

/**
 * Get a database session
 */
function getDbSession() {
  if (!_session_maker) {
    throw new Error('Database not initialized');
  }
  return _session_maker();
}

/**
 * Get statistics about feature completion progress.
 *
 * Returns the number of passing features, in-progress features, total features,
 * and completion percentage. Use this to track overall progress of the implementation.
 *
 * Returns:
 *     JSON with: passing (int), in_progress (int), total (int), percentage (float)
 */
export function feature_get_stats(): string {
  const session = getDbSession();
  try {
    const allFeatures = session.query<any>('SELECT passes, in_progress FROM features');

    const total = allFeatures.length;
    const passing = allFeatures.filter((f: any) => f.passes).length;
    const in_progress = allFeatures.filter((f: any) => f.in_progress).length;
    const percentage = total > 0 ? Math.round((passing / total) * 100 * 10) / 10 : 0.0;

    return JSON.stringify({
      passing,
      in_progress,
      total,
      percentage,
    });
  } finally {
    session.close();
  }
}

/**
 * Get a specific feature by its ID.
 *
 * Returns the full details of a feature including its name, description,
 * verification steps, and current status.
 *
 * Args:
 *     feature_id: The ID of the feature to retrieve
 *
 * Returns:
 *     JSON with feature details, or error if not found.
 */
export function feature_get_by_id(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    const row = rows[0];
    const feature: Feature = {
      id: row.id,
      priority: row.priority,
      category: row.category,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps || '[]'),
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
    };

    return JSON.stringify(feature);
  } finally {
    session.close();
  }
}

/**
 * Get minimal feature info: id, name, status, and dependencies only.
 *
 * Use this instead of feature_get_by_id when you only need status info,
 * not the full description and steps. This reduces response size significantly.
 *
 * Args:
 *     feature_id: The ID of the feature to retrieve
 *
 * Returns:
 *     JSON with: id, name, passes, in_progress, dependencies
 */
export function feature_get_summary(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>(
      'SELECT id, name, passes, in_progress, dependencies FROM features WHERE id = ?',
      [feature_id]
    );

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    const row = rows[0];
    return JSON.stringify({
      id: row.id,
      name: row.name,
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
    });
  } finally {
    session.close();
  }
}

/**
 * Mark a feature as passing after successful implementation.
 *
 * Updates the feature's passes field to true and clears the in_progress flag.
 * Use this after you have implemented the feature and verified it works correctly.
 *
 * Args:
 *     feature_id: The ID of the feature to mark as passing
 *
 * Returns:
 *     JSON with success confirmation: {success, feature_id, name}
 */
export function feature_mark_passing(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT id, name FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    session.execute(
      'UPDATE features SET passes = ?, in_progress = ? WHERE id = ?',
      1,
      0,
      feature_id
    );

    return JSON.stringify({
      success: true,
      feature_id,
      name: rows[0].name,
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to mark feature passing: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Mark a feature as failing after finding a regression.
 *
 * Updates the feature's passes field to false and clears the in_progress flag.
 * Use this when a testing agent discovers that a previously-passing feature
 * no longer works correctly (regression detected).
 *
 * After marking as failing, you should:
 * 1. Investigate the root cause
 * 2. Fix the regression
 * 3. Verify the fix
 * 4. Call feature_mark_passing once fixed
 *
 * Args:
 *     feature_id: The ID of the feature to mark as failing
 *
 * Returns:
 *     JSON with the updated feature details, or error if not found.
 */
export function feature_mark_failing(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    session.execute(
      'UPDATE features SET passes = ?, in_progress = ? WHERE id = ?',
      0,
      0,
      feature_id
    );

    // Fetch updated feature
    const updated = session.query<any>('SELECT * FROM features WHERE id = ?', [feature_id])[0];
    const feature: Feature = {
      id: updated.id,
      priority: updated.priority,
      category: updated.category,
      name: updated.name,
      description: updated.description,
      steps: JSON.parse(updated.steps || '[]'),
      passes: Boolean(updated.passes),
      in_progress: Boolean(updated.in_progress),
      dependencies: updated.dependencies ? JSON.parse(updated.dependencies) : null,
    };

    return JSON.stringify({
      message: `Feature #${feature_id} marked as failing - regression detected`,
      feature,
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to mark feature failing: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Skip a feature by moving it to the end of the priority queue.
 *
 * Use this when a feature cannot be implemented yet due to:
 * - Dependencies on other features that aren't implemented yet
 * - External blockers (missing assets, unclear requirements)
 * - Technical prerequisites that need to be addressed first
 *
 * The feature's priority is set to max_priority + 1, so it will be
 * worked on after all other pending features. Also clears the in_progress
 * flag so the feature returns to "pending" status.
 *
 * Args:
 *     feature_id: The ID of the feature to skip
 *
 * Returns:
 *     JSON with skip details: id, name, old_priority, new_priority, message
 */
export function feature_skip(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    const feature = rows[0];
    if (feature.passes) {
      return JSON.stringify({ error: 'Cannot skip a feature that is already passing' });
    }

    const old_priority = feature.priority;

    // Use lock to prevent race condition in priority assignment
    lockPriority();
    try {
      const maxRows = session.query<any>('SELECT MAX(priority) as max_priority FROM features');
      const new_priority = (maxRows[0]?.max_priority ?? 0) + 1;

      session.execute(
        'UPDATE features SET priority = ?, in_progress = ? WHERE id = ?',
        new_priority,
        0,
        feature_id
      );

      return JSON.stringify({
        id: feature_id,
        name: feature.name,
        old_priority,
        new_priority,
        message: `Feature '${feature.name}' moved to end of queue`,
      });
    } finally {
      unlockPriority();
    }
  } catch (error) {
    return JSON.stringify({ error: `Failed to skip feature: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Mark a feature as in-progress.
 *
 * This prevents other agent sessions from working on the same feature.
 * Call this after getting your assigned feature details with feature_get_by_id.
 *
 * Args:
 *     feature_id: The ID of the feature to mark as in-progress
 *
 * Returns:
 *     JSON with the updated feature details, or error if not found or already in-progress.
 */
export function feature_mark_in_progress(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    const feature = rows[0];
    if (feature.passes) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} is already passing` });
    }

    if (feature.in_progress) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} is already in-progress` });
    }

    session.execute('UPDATE features SET in_progress = ? WHERE id = ?', 1, feature_id);

    // Fetch updated feature
    const updated = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id)[0];
    const result: Feature = {
      id: updated.id,
      priority: updated.priority,
      category: updated.category,
      name: updated.name,
      description: updated.description,
      steps: JSON.parse(updated.steps || '[]'),
      passes: Boolean(updated.passes),
      in_progress: Boolean(updated.in_progress),
      dependencies: updated.dependencies ? JSON.parse(updated.dependencies) : null,
    };

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: `Failed to mark feature in-progress: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Atomically claim a feature (mark in-progress) and return its full details.
 *
 * Combines feature_mark_in_progress + feature_get_by_id into a single operation.
 * If already in-progress, still returns the feature details (idempotent).
 *
 * Args:
 *     feature_id: The ID of the feature to claim and retrieve
 *
 * Returns:
 *     JSON with feature details including claimed status, or error if not found.
 */
export function feature_claim_and_get(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    const feature = rows[0];
    if (feature.passes) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} is already passing` });
    }

    const already_claimed = Boolean(feature.in_progress);
    if (!already_claimed) {
      session.execute('UPDATE features SET in_progress = ? WHERE id = ?', 1, feature_id);
    }

    // Fetch (potentially updated) feature
    const updated = session.query<any>('SELECT * FROM features WHERE id = ?', [feature_id])[0];
    const result: Feature & { already_claimed: boolean } = {
      id: updated.id,
      priority: updated.priority,
      category: updated.category,
      name: updated.name,
      description: updated.description,
      steps: JSON.parse(updated.steps || '[]'),
      passes: Boolean(updated.passes),
      in_progress: Boolean(updated.in_progress),
      dependencies: updated.dependencies ? JSON.parse(updated.dependencies) : null,
      already_claimed,
    };

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: `Failed to claim feature: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Clear in-progress status from a feature.
 *
 * Use this when abandoning a feature or manually unsticking a stuck feature.
 * The feature will return to the pending queue.
 *
 * Args:
 *     feature_id: The ID of the feature to clear in-progress status
 *
 * Returns:
 *     JSON with the updated feature details, or error if not found.
 */
export function feature_clear_in_progress(feature_id: number): string {
  const session = getDbSession();
  try {
    const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (rows.length === 0) {
      return JSON.stringify({ error: `Feature with ID ${feature_id} not found` });
    }

    session.execute('UPDATE features SET in_progress = ? WHERE id = ?', 0, feature_id);

    // Fetch updated feature
    const updated = session.query<any>('SELECT * FROM features WHERE id = ?', [feature_id])[0];
    const result: Feature = {
      id: updated.id,
      priority: updated.priority,
      category: updated.category,
      name: updated.name,
      description: updated.description,
      steps: JSON.parse(updated.steps || '[]'),
      passes: Boolean(updated.passes),
      in_progress: Boolean(updated.in_progress),
      dependencies: updated.dependencies ? JSON.parse(updated.dependencies) : null,
    };

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: `Failed to clear in-progress status: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Create multiple features in a single operation.
 *
 * Features are assigned sequential priorities based on their order.
 * All features start with passes=false.
 *
 * This is typically used by the initializer agent to set up the initial
 * feature list from the app specification.
 *
 * Args:
 *     features: List of features to create, each with:
 *         - category (str): Feature category
 *         - name (str): Feature name
 *         - description (str): Detailed description
 *         - steps (list[str]): Implementation/test steps
 *         - depends_on_indices (list[int], optional): Array indices (0-based) of
 *           features in THIS batch that this feature depends on. Use this instead
 *           of 'dependencies' since IDs aren't known until after creation.
 *           Example: [0, 2] means this feature depends on features at index 0 and 2.
 *
 * Returns:
 *     JSON with: created (int) - number of features created, with_dependencies (int)
 */
export function feature_create_bulk(
  features: Array<{
    category: string;
    name: string;
    description: string;
    steps: string[];
    depends_on_indices?: number[];
  }>
): string {
  const session = getDbSession();
  try {
    // First pass: validate all features and their index-based dependencies
    for (let i = 0; i < features.length; i++) {
      const feature_data = features[i];

      // Validate required fields
      if (
        !feature_data.category ||
        !feature_data.name ||
        !feature_data.description ||
        !feature_data.steps
      ) {
        return JSON.stringify({
          error: `Feature at index ${i} missing required fields (category, name, description, steps)`,
        });
      }

      // Validate depends_on_indices
      const indices = feature_data.depends_on_indices || [];
      if (indices.length > 0) {
        // Check max dependencies
        if (indices.length > MAX_DEPENDENCIES) {
          return JSON.stringify({
            error: `Feature at index ${i} has ${indices.length} dependencies, max is ${MAX_DEPENDENCIES}`,
          });
        }
        // Check for duplicates
        if (new Set(indices).size !== indices.length) {
          return JSON.stringify({
            error: `Feature at index ${i} has duplicate dependencies`,
          });
        }
        // Check for forward references (can only depend on earlier features)
        for (const idx of indices) {
          if (!Number.isInteger(idx) || idx < 0) {
            return JSON.stringify({
              error: `Feature at index ${i} has invalid dependency index: ${idx}`,
            });
          }
          if (idx >= i) {
            return JSON.stringify({
              error: `Feature at index ${i} cannot depend on feature at index ${idx} (forward reference not allowed)`,
            });
          }
        }
      }
    }

    // Use lock to prevent race condition in priority assignment
    lockPriority();
    try {
      // Get starting priority
      const maxRows = session.query<any>('SELECT MAX(priority) as max_priority FROM features');
      const start_priority = (maxRows[0]?.max_priority ?? 0) + 1;

      // Second pass: create all features
      const created_features: number[] = [];
      for (let i = 0; i < features.length; i++) {
        const feature_data = features[i];
        session.execute(
          'INSERT INTO features (priority, category, name, description, steps, passes, in_progress, dependencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            start_priority + i,
            feature_data.category,
            feature_data.name,
            feature_data.description,
            JSON.stringify(feature_data.steps),
            0,
            0,
            null,
          ]
        );
        // Get the last inserted ID
        const idRows = session.query<any>('SELECT last_insert_rowid() as id');
        created_features.push(idRows[0].id);
      }

      // Third pass: resolve index-based dependencies to actual IDs
      let deps_count = 0;
      for (let i = 0; i < features.length; i++) {
        const indices = features[i].depends_on_indices || [];
        if (indices.length > 0) {
          const dep_ids = indices.map((idx) => created_features[idx]).sort((a, b) => a - b);
          session.execute('UPDATE features SET dependencies = ? WHERE id = ?', [
            JSON.stringify(dep_ids),
            created_features[i],
          ]);
          deps_count++;
        }
      }

      return JSON.stringify({
        created: created_features.length,
        with_dependencies: deps_count,
      });
    } finally {
      unlockPriority();
    }
  } catch (error) {
    return JSON.stringify({ error: String(error) });
  } finally {
    session.close();
  }
}

/**
 * Create a single feature in the project backlog.
 *
 * Use this when the user asks to add a new feature, capability, or test case.
 * The feature will be added with the next available priority number.
 *
 * Args:
 *     category: Feature category for grouping (e.g., 'Authentication', 'API', 'UI')
 *     name: Descriptive name for the feature
 *     description: Detailed description of what this feature should do
 *     steps: List of steps to implement or verify the feature
 *
 * Returns:
 *     JSON with the created feature details including its ID
 */
export function feature_create(
  category: string,
  name: string,
  description: string,
  steps: string[]
): string {
  const session = getDbSession();
  try {
    // Use lock to prevent race condition in priority assignment
    lockPriority();
    try {
      const maxRows = session.query<any>('SELECT MAX(priority) as max_priority FROM features');
      const next_priority = (maxRows[0]?.max_priority ?? 0) + 1;

      session.execute(
        'INSERT INTO features (priority, category, name, description, steps, passes, in_progress, dependencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [next_priority, category, name, description, JSON.stringify(steps), 0, 0, null]
      );

      // Get the created feature
      const idRows = session.query<any>('SELECT last_insert_rowid() as id');
      const feature_id = idRows[0].id;
      const rows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);
      const row = rows[0];

      const feature: Feature = {
        id: row.id,
        priority: row.priority,
        category: row.category,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps || '[]'),
        passes: Boolean(row.passes),
        in_progress: Boolean(row.in_progress),
        dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
      };

      return JSON.stringify({
        success: true,
        message: `Created feature: ${name}`,
        feature,
      });
    } finally {
      unlockPriority();
    }
  } catch (error) {
    return JSON.stringify({ error: String(error) });
  } finally {
    session.close();
  }
}

/**
 * Add a dependency relationship between features.
 *
 * The dependency_id feature must be completed before feature_id can be started.
 * Validates: self-reference, existence, circular dependencies, max limit.
 *
 * Args:
 *     feature_id: The ID of the feature that will depend on another feature
 *     dependency_id: The ID of the feature that must be completed first
 *
 * Returns:
 *     JSON with success status and updated dependencies list, or error message
 */
export function feature_add_dependency(feature_id: number, dependency_id: number): string {
  const session = getDbSession();
  try {
    // Security: Self-reference check
    if (feature_id === dependency_id) {
      return JSON.stringify({ error: 'A feature cannot depend on itself' });
    }

    const featureRows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);
    const dependencyRows = session.query<any>('SELECT * FROM features WHERE id = ?', dependency_id);

    if (featureRows.length === 0) {
      return JSON.stringify({ error: `Feature ${feature_id} not found` });
    }
    if (dependencyRows.length === 0) {
      return JSON.stringify({ error: `Dependency feature ${dependency_id} not found` });
    }

    const feature = featureRows[0];
    const current_deps: number[] = feature.dependencies ? JSON.parse(feature.dependencies) : [];

    // Security: Max dependencies limit
    if (current_deps.length >= MAX_DEPENDENCIES) {
      return JSON.stringify({
        error: `Maximum ${MAX_DEPENDENCIES} dependencies allowed per feature`,
      });
    }

    // Check if already exists
    if (current_deps.includes(dependency_id)) {
      return JSON.stringify({ error: 'Dependency already exists' });
    }

    // Security: Circular dependency check
    const all_features_rows = session.query<any>('SELECT * FROM features');
    const all_features: Feature[] = all_features_rows.map((row: any) => ({
      id: row.id,
      priority: row.priority,
      category: row.category,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps || '[]'),
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
    }));

    if (would_create_circular_dependency(all_features, feature_id, dependency_id)) {
      return JSON.stringify({ error: 'Cannot add: would create circular dependency' });
    }

    // Add dependency
    current_deps.push(dependency_id);
    const sorted_deps = current_deps.sort((a, b) => a - b);

    session.execute(
      'UPDATE features SET dependencies = ? WHERE id = ?',
      JSON.stringify(sorted_deps),
      feature_id
    );

    return JSON.stringify({
      success: true,
      feature_id,
      dependencies: sorted_deps,
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to add dependency: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Remove a dependency from a feature.
 *
 * Args:
 *     feature_id: The ID of the feature to remove a dependency from
 *     dependency_id: The ID of the dependency to remove
 *
 * Returns:
 *     JSON with success status and updated dependencies list, or error message
 */
export function feature_remove_dependency(feature_id: number, dependency_id: number): string {
  const session = getDbSession();
  try {
    const featureRows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);

    if (featureRows.length === 0) {
      return JSON.stringify({ error: `Feature ${feature_id} not found` });
    }

    const feature = featureRows[0];
    const current_deps: number[] = feature.dependencies ? JSON.parse(feature.dependencies) : [];

    if (!current_deps.includes(dependency_id)) {
      return JSON.stringify({ error: 'Dependency does not exist' });
    }

    const updated_deps = current_deps.filter((d) => d !== dependency_id);
    const deps_to_save = updated_deps.length > 0 ? JSON.stringify(updated_deps) : null;

    session.execute('UPDATE features SET dependencies = ? WHERE id = ?', deps_to_save, feature_id);

    return JSON.stringify({
      success: true,
      feature_id,
      dependencies: updated_deps,
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to remove dependency: ${error}` });
  } finally {
    session.close();
  }
}

/**
 * Get all features ready to start (dependencies satisfied, not in progress).
 *
 * Useful for parallel execution - returns multiple features that can run simultaneously.
 * A feature is ready if it is not passing, not in progress, and all dependencies are passing.
 *
 * Args:
 *     limit: Maximum number of features to return (1-50, default 10)
 *
 * Returns:
 *     JSON with: features (list), count (int), total_ready (int)
 */
export function feature_get_ready(limit: number = 10): string {
  const session = getDbSession();
  try {
    const all_features_rows = session.query<any>('SELECT * FROM features');
    const all_features: Feature[] = all_features_rows.map((row: any) => ({
      id: row.id,
      priority: row.priority,
      category: row.category,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps || '[]'),
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
    }));

    const passing_ids = new Set(all_features.filter((f) => f.passes).map((f) => f.id));

    const ready: Feature[] = [];
    for (const f of all_features) {
      if (f.passes || f.in_progress) {
        continue;
      }
      const deps = f.dependencies || [];
      if (deps.every((dep_id) => passing_ids.has(dep_id))) {
        ready.push(f);
      }
    }

    // Sort by scheduling score (higher = first), then priority, then id
    const scores = compute_scheduling_scores(all_features);
    ready.sort((a, b) => {
      const scoreA = scores.get(a.id) ?? 0;
      const scoreB = scores.get(b.id) ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id - b.id;
    });

    return JSON.stringify({
      features: ready.slice(0, limit),
      count: Math.min(ready.length, limit),
      total_ready: ready.length,
    });
  } finally {
    session.close();
  }
}

/**
 * Get features that are blocked by unmet dependencies.
 *
 * Returns features that have dependencies which are not yet passing.
 * Each feature includes a 'blocked_by' field listing the blocking feature IDs.
 *
 * Args:
 *     limit: Maximum number of features to return (1-100, default 20)
 *
 * Returns:
 *     JSON with: features (list with blocked_by field), count (int), total_blocked (int)
 */
export function feature_get_blocked(limit: number = 20): string {
  const session = getDbSession();
  try {
    const all_features_rows = session.query<any>('SELECT * FROM features');
    const all_features: Feature[] = all_features_rows.map((row: any) => ({
      id: row.id,
      priority: row.priority,
      category: row.category,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps || '[]'),
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
    }));

    const passing_ids = new Set(all_features.filter((f) => f.passes).map((f) => f.id));

    const blocked: Array<Feature & { blocked_by: number[] }> = [];
    for (const f of all_features) {
      if (f.passes) {
        continue;
      }
      const deps = f.dependencies || [];
      const blocking = deps.filter((d) => !passing_ids.has(d));
      if (blocking.length > 0) {
        blocked.push({ ...f, blocked_by: blocking });
      }
    }

    return JSON.stringify({
      features: blocked.slice(0, limit),
      count: Math.min(blocked.length, limit),
      total_blocked: blocked.length,
    });
  } finally {
    session.close();
  }
}

/**
 * Get dependency graph data for visualization.
 *
 * Returns nodes (features) and edges (dependencies) for rendering a graph.
 * Each node includes status: 'pending', 'in_progress', 'done', or 'blocked'.
 *
 * Returns:
 *     JSON with: nodes (list), edges (list of {source, target})
 */
export function feature_get_graph(): string {
  const session = getDbSession();
  try {
    const all_features_rows = session.query<any>('SELECT * FROM features');
    const all_features: Feature[] = all_features_rows.map((row: any) => ({
      id: row.id,
      priority: row.priority,
      category: row.category,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps || '[]'),
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
    }));

    const passing_ids = new Set(all_features.filter((f) => f.passes).map((f) => f.id));

    const nodes: Array<{
      id: number;
      name: string;
      category: string;
      status: 'pending' | 'in_progress' | 'done' | 'blocked';
      priority: number;
      dependencies: number[];
    }> = [];
    const edges: Array<{ source: number; target: number }> = [];

    for (const f of all_features) {
      const deps = f.dependencies || [];
      const blocking = deps.filter((d) => !passing_ids.has(d));

      let status: 'pending' | 'in_progress' | 'done' | 'blocked';
      if (f.passes) {
        status = 'done';
      } else if (blocking.length > 0) {
        status = 'blocked';
      } else if (f.in_progress) {
        status = 'in_progress';
      } else {
        status = 'pending';
      }

      nodes.push({
        id: f.id,
        name: f.name,
        category: f.category,
        status,
        priority: f.priority,
        dependencies: deps,
      });

      for (const dep_id of deps) {
        edges.push({ source: dep_id, target: f.id });
      }
    }

    return JSON.stringify({ nodes, edges });
  } finally {
    session.close();
  }
}

/**
 * Set all dependencies for a feature at once, replacing any existing dependencies.
 *
 * Validates: self-reference, existence of all dependencies, circular dependencies, max limit.
 *
 * Args:
 *     feature_id: The ID of the feature to set dependencies for
 *     dependency_ids: List of feature IDs that must be completed first
 *
 * Returns:
 *     JSON with success status and updated dependencies list, or error message
 */
export function feature_set_dependencies(feature_id: number, dependency_ids: number[]): string {
  const session = getDbSession();
  try {
    // Security: Self-reference check
    if (dependency_ids.includes(feature_id)) {
      return JSON.stringify({ error: 'A feature cannot depend on itself' });
    }

    // Security: Max dependencies limit
    if (dependency_ids.length > MAX_DEPENDENCIES) {
      return JSON.stringify({
        error: `Maximum ${MAX_DEPENDENCIES} dependencies allowed`,
      });
    }

    // Check for duplicates
    if (new Set(dependency_ids).size !== dependency_ids.length) {
      return JSON.stringify({ error: 'Duplicate dependencies not allowed' });
    }

    const featureRows = session.query<any>('SELECT * FROM features WHERE id = ?', feature_id);
    if (featureRows.length === 0) {
      return JSON.stringify({ error: `Feature ${feature_id} not found` });
    }

    // Validate all dependencies exist
    const all_features_rows = session.query<any>('SELECT * FROM features');
    const all_feature_ids = new Set(all_features_rows.map((row: any) => row.id));
    const missing = dependency_ids.filter((d) => !all_feature_ids.has(d));
    if (missing.length > 0) {
      return JSON.stringify({ error: `Dependencies not found: ${JSON.stringify(missing)}` });
    }

    // Check for circular dependencies
    const all_features: Feature[] = all_features_rows.map((row: any) => ({
      id: row.id,
      priority: row.priority,
      category: row.category,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps || '[]'),
      passes: Boolean(row.passes),
      in_progress: Boolean(row.in_progress),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
    }));

    // Create test features with updated dependencies
    const test_features = all_features.map((f) =>
      f.id === feature_id ? { ...f, dependencies: dependency_ids } : f
    );

    for (const dep_id of dependency_ids) {
      if (would_create_circular_dependency(test_features, feature_id, dep_id)) {
        return JSON.stringify({
          error: `Cannot add dependency ${dep_id}: would create circular dependency`,
        });
      }
    }

    // Set dependencies
    const sorted_deps = dependency_ids.length > 0 ? [...dependency_ids].sort((a, b) => a - b) : [];
    const deps_to_save = sorted_deps.length > 0 ? JSON.stringify(sorted_deps) : null;

    session.execute('UPDATE features SET dependencies = ? WHERE id = ?', deps_to_save, feature_id);

    return JSON.stringify({
      success: true,
      feature_id,
      dependencies: sorted_deps,
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to set dependencies: ${error}` });
  } finally {
    session.close();
  }
}
