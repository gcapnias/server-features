/**
 * Dependency Resolver
 * ===================
 *
 * Provides dependency resolution using Kahn's algorithm for topological sorting.
 * Includes cycle detection, validation, and helper functions for dependency management.
 */

import type { Feature, DependencyResult } from '@gcapnias/shared-types';
import { MAX_DEPENDENCY_DEPTH, MAX_DEPENDENCIES } from '@gcapnias/shared-types';
import { Heap } from 'heap-js';

/**
 * Topological sort with comprehensive dependency analysis
 * Python: def resolve_dependencies(features: list[Feature]) -> DependencyResult
 * Note: TypeScript function name must be 'topological_sort_with_analysis()'
 *
 * Uses Kahn's algorithm with min-heap for priority-aware ordering.
 * Detects cycles, missing dependencies, and blocked features.
 *
 * @param features - List of all features
 * @returns Dependency analysis with ordered features, cycles, blocked features
 */
export function resolve_dependencies(features: Feature[]): DependencyResult {
  const feature_map = new Map<number, Feature>(features.map((f) => [f.id, f]));
  const in_degree = new Map<number, number>(features.map((f) => [f.id, 0]));
  const adjacency = new Map<number, number[]>(features.map((f) => [f.id, []]));
  const blocked = new Map<number, number[]>();
  const missing = new Map<number, number[]>();

  // Build graph
  for (const feature of features) {
    const deps = feature.dependencies || [];
    for (const dep_id of deps) {
      if (!feature_map.has(dep_id)) {
        const current_missing = missing.get(feature.id) || [];
        missing.set(feature.id, [...current_missing, dep_id]);
      } else {
        const adj = adjacency.get(dep_id) || [];
        adjacency.set(dep_id, [...adj, feature.id]);
        in_degree.set(feature.id, (in_degree.get(feature.id) || 0) + 1);

        // Track blocked features
        const dep = feature_map.get(dep_id)!;
        if (!dep.passes) {
          const current_blocked = blocked.get(feature.id) || [];
          blocked.set(feature.id, [...current_blocked, dep_id]);
        }
      }
    }
  }

  // Kahn's algorithm with priority-aware selection using a heap
  // Heap uses: (priority, id) for stable ordering
  const heap = new Heap<Feature>((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id - b.id;
  });

  for (const f of features) {
    if (in_degree.get(f.id) === 0) {
      heap.push(f);
    }
  }

  const ordered: Feature[] = [];

  while (heap.size() > 0) {
    const current = heap.pop()!;
    ordered.push(current);

    for (const dependent_id of adjacency.get(current.id) || []) {
      const new_degree = (in_degree.get(dependent_id) || 0) - 1;
      in_degree.set(dependent_id, new_degree);

      if (new_degree === 0) {
        const dep_feature = feature_map.get(dependent_id)!;
        heap.push(dep_feature);
      }
    }
  }

  // Detect cycles (features not in ordered = part of cycle)
  let cycles: number[][] = [];
  if (ordered.length < features.length) {
    const remaining = features.filter((f) => !ordered.includes(f));
    cycles = _detect_cycles(remaining);
    ordered.push(...remaining); // Add cyclic features at end
  }

  return {
    ordered_features: ordered,
    circular_dependencies: cycles,
    blocked_features: blocked,
    missing_dependencies: missing,
  };
}

/**
 * Check if feature dependencies are satisfied
 * Python: def are_dependencies_satisfied(feature: Feature, all_features: list[Feature], passing_ids: set[int] | None = None) -> bool
 * Note: TypeScript function name must be 'feature_is_ready()'
 * @param feature - Feature to check
 * @param passing_ids - Optional set of passing feature IDs for optimization
 * @returns True if all dependencies have passes=true
 */
export function are_dependencies_satisfied(feature: Feature, passing_ids?: Set<number>): boolean {
  const deps = feature.dependencies || [];
  if (deps.length === 0) {
    return true;
  }

  if (!passing_ids) {
    // Should not be called without passing_ids in production, but handle it
    throw new Error('are_dependencies_satisfied requires passing_ids parameter');
  }

  return deps.every((dep_id) => passing_ids.has(dep_id));
}

/**
 * Get list of incomplete dependency IDs
 * Python: def get_blocking_dependencies(feature: Feature, all_features: list[Feature], passing_ids: set[int] | None = None) -> list[int]
 * Note: TypeScript function name must be 'get_incomplete_dependencies()'
 * @param feature - Feature to check
 * @param passing_ids - Optional set for optimization
 * @returns List of dependency IDs that are not complete
 */
export function get_blocking_dependencies(feature: Feature, passing_ids?: Set<number>): number[] {
  const deps = feature.dependencies || [];

  if (!passing_ids) {
    // Should not be called without passing_ids in production, but handle it
    throw new Error('get_blocking_dependencies requires passing_ids parameter');
  }

  return deps.filter((dep_id) => !passing_ids.has(dep_id));
}

/**
 * Check if adding edge would create dependency cycle
 * Python: def would_create_circular_dependency(features: list[Feature], source_id: int, target_id: int) -> bool
 * Note: TypeScript function name must be 'would_create_cycle()'
 *
 * Uses DFS with depth limit for security (MAX_DEPENDENCY_DEPTH=50).
 *
 * @param features - All features
 * @param source_id - Source feature ID
 * @param target_id - Target feature ID
 * @returns True if adding edge creates cycle
 */
export function would_create_circular_dependency(
  features: Feature[],
  source_id: number,
  target_id: number
): boolean {
  // Self-reference is a cycle
  if (source_id === target_id) {
    return true;
  }

  const feature_map = new Map<number, Feature>(features.map((f) => [f.id, f]));
  const source = feature_map.get(source_id);
  const target = feature_map.get(target_id);

  if (!source || !target) {
    return false;
  }

  // DFS from target to see if we can reach source
  const visited = new Set<number>();

  function can_reach(current_id: number, depth: number = 0): boolean {
    // Security: Prevent stack overflow with depth limit
    if (depth > MAX_DEPENDENCY_DEPTH) {
      return true; // Assume cycle if too deep (fail-safe)
    }

    if (current_id === source_id) {
      return true;
    }

    if (visited.has(current_id)) {
      return false;
    }

    visited.add(current_id);

    const current = feature_map.get(current_id);
    if (!current) {
      return false;
    }

    const deps = current.dependencies || [];
    for (const dep_id of deps) {
      if (can_reach(dep_id, depth + 1)) {
        return true;
      }
    }

    return false;
  }

  return can_reach(target_id);
}

/**
 * Validate dependency list
 * Python: def validate_dependencies(feature_id: int, dependency_ids: list[int], all_feature_ids: set[int]) -> tuple[bool, str]
 *
 * Checks: max limit, self-reference, existence, duplicates
 *
 * @param feature_id - ID of feature being validated
 * @param dependency_ids - List of proposed dependency IDs
 * @param all_feature_ids - Set of all valid feature IDs
 * @returns Tuple of [is_valid, error_message]
 */
export function validate_dependencies(
  feature_id: number,
  dependency_ids: number[],
  all_feature_ids: Set<number>
): [boolean, string] {
  // Security: Check limits
  if (dependency_ids.length > MAX_DEPENDENCIES) {
    return [false, `Maximum ${MAX_DEPENDENCIES} dependencies allowed`];
  }

  // Check self-reference
  if (dependency_ids.includes(feature_id)) {
    return [false, 'A feature cannot depend on itself'];
  }

  // Check all dependencies exist
  const missing = dependency_ids.filter((d) => !all_feature_ids.has(d));
  if (missing.length > 0) {
    return [false, `Dependencies not found: ${missing.join(', ')}`];
  }

  // Check for duplicates
  if (dependency_ids.length !== new Set(dependency_ids).size) {
    return [false, 'Duplicate dependencies not allowed'];
  }

  return [true, ''];
}

/**
 * Find all dependency cycles using DFS
 * Python: def _detect_cycles(features: list[Feature], feature_map: dict) -> list[list[int]]
 * Note: TypeScript function name must be 'find_cycles_dfs()'
 *
 * Internal helper for cycle detection.
 *
 * @param features - All features
 * @returns List of cycles, each cycle is list of feature IDs
 */
export function _detect_cycles(features: Feature[]): number[][] {
  const feature_map = new Map<number, Feature>(features.map((f) => [f.id, f]));
  const cycles: number[][] = [];
  const visited = new Set<number>();
  const rec_stack = new Set<number>();
  const path: number[] = [];

  function dfs(fid: number): boolean {
    visited.add(fid);
    rec_stack.add(fid);
    path.push(fid);

    const feature = feature_map.get(fid);
    if (feature) {
      const deps = feature.dependencies || [];
      for (const dep_id of deps) {
        if (!visited.has(dep_id)) {
          if (dfs(dep_id)) {
            return true;
          }
        } else if (rec_stack.has(dep_id)) {
          const cycle_start = path.indexOf(dep_id);
          cycles.push([...path.slice(cycle_start)]);
          return true;
        }
      }
    }

    path.pop();
    rec_stack.delete(fid);
    return false;
  }

  for (const f of features) {
    if (!visited.has(f.id)) {
      dfs(f.id);
    }
  }

  return cycles;
}

/**
 * Calculate priority scores for scheduling
 * Python: def compute_scheduling_scores(features: list[Feature]) -> dict[int, float]
 *
 * Formula: (1000 * unblock) + (100 * depth_score) + (10 * priority_factor)
 *
 * @param features - All features
 * @returns Map of feature_id → score
 */
export function compute_scheduling_scores(features: Feature[]): Map<number, number> {
  if (features.length === 0) {
    return new Map();
  }

  // Build adjacency lists
  const children = new Map<number, number[]>(features.map((f) => [f.id, []]));
  const parents = new Map<number, number[]>(features.map((f) => [f.id, []]));

  for (const f of features) {
    const deps = f.dependencies || [];
    for (const dep_id of deps) {
      if (children.has(dep_id)) {
        children.get(dep_id)!.push(f.id);
        parents.get(f.id)!.push(dep_id);
      }
    }
  }

  // Calculate depths via BFS from roots
  const depths = new Map<number, number>();
  const roots = features.filter((f) => (parents.get(f.id) || []).length === 0).map((f) => f.id);
  const queue: Array<[number, number]> = roots.map((root) => [root, 0]);

  while (queue.length > 0) {
    const [node_id, depth] = queue.shift()!;
    if (!depths.has(node_id) || depth > depths.get(node_id)!) {
      depths.set(node_id, depth);
    }
    for (const child_id of children.get(node_id) || []) {
      queue.push([child_id, depth + 1]);
    }
  }

  // Handle orphaned nodes
  for (const f of features) {
    if (!depths.has(f.id)) {
      depths.set(f.id, 0);
    }
  }

  // Calculate transitive downstream counts
  const downstream = new Map<number, number>(features.map((f) => [f.id, 0]));
  const sorted_ids = [...depths.keys()].sort((a, b) => (depths.get(b) || 0) - (depths.get(a) || 0));

  for (const fid of sorted_ids) {
    for (const parent_id of parents.get(fid) || []) {
      downstream.set(parent_id, (downstream.get(parent_id) || 0) + 1 + (downstream.get(fid) || 0));
    }
  }

  // Normalize and compute scores
  const max_depth = Math.max(...depths.values());
  const max_downstream = Math.max(...downstream.values());

  const scores = new Map<number, number>();
  for (const f of features) {
    const fid = f.id;

    // Unblocking score: 0-1, higher = unblocks more
    const unblock = max_downstream > 0 ? (downstream.get(fid) || 0) / max_downstream : 0;

    // Depth score: 0-1, higher = closer to root (no deps)
    const depth_score = max_depth > 0 ? 1 - (depths.get(fid) || 0) / max_depth : 1;

    // Priority factor: 0-1, lower priority number = higher factor
    const priority = f.priority;
    const priority_factor = (10 - Math.min(priority, 10)) / 10;

    scores.set(fid, 1000 * unblock + 100 * depth_score + 10 * priority_factor);
  }

  return scores;
}

/**
 * Get features ready to work on
 * Python: def get_ready_features(features: list[Feature], limit: int = 10) -> list[Feature]
 *
 * Filters: not passing, not in_progress, dependencies satisfied
 * Sorted by: scheduling score, then priority, then id
 *
 * @param features - All features
 * @param limit - Maximum number of features to return
 * @returns Sorted list of actionable features
 */
export function get_ready_features(features: Feature[], limit: number = 10): Feature[] {
  const passing_ids = new Set(features.filter((f) => f.passes).map((f) => f.id));

  const ready: Feature[] = [];
  for (const f of features) {
    if (f.passes || f.in_progress) {
      continue;
    }
    const deps = f.dependencies || [];
    if (deps.every((dep_id) => passing_ids.has(dep_id))) {
      ready.push(f);
    }
  }

  // Sort by scheduling score (higher = first), then priority, then id
  const scores = compute_scheduling_scores(features);
  ready.sort((a, b) => {
    const score_diff = (scores.get(b.id) || 0) - (scores.get(a.id) || 0);
    if (score_diff !== 0) return score_diff;

    const priority_diff = a.priority - b.priority;
    if (priority_diff !== 0) return priority_diff;

    return a.id - b.id;
  });

  return ready.slice(0, limit);
}

/**
 * Get blocked features with blocking dependency info
 * Python: def get_blocked_features(features: list[Feature]) -> list[Feature]
 *
 * Adds 'blocked_by' field with list of blocking IDs.
 * Excludes already-passing features.
 *
 * @param features - All features
 * @returns Features that are blocked, with blocked_by field
 */
export function get_blocked_features(
  features: Feature[]
): Array<Feature & { blocked_by: number[] }> {
  const passing_ids = new Set(features.filter((f) => f.passes).map((f) => f.id));

  const blocked: Array<Feature & { blocked_by: number[] }> = [];
  for (const f of features) {
    if (f.passes) {
      continue;
    }
    const deps = f.dependencies || [];
    const blocking = deps.filter((d) => !passing_ids.has(d));
    if (blocking.length > 0) {
      blocked.push({ ...f, blocked_by: blocking });
    }
  }

  return blocked;
}

/**
 * Build dependency graph visualization data
 * Python: def build_graph_data(features: list[Feature]) -> dict
 * Note: TypeScript function name must be 'build_dependency_graph()'
 *
 * Returns graph with nodes and edges for visualization.
 * Node status: "done", "blocked", "in_progress", "pending"
 *
 * @param features - All features
 * @returns Graph data with nodes and edges arrays
 */
export function build_graph_data(features: Feature[]): {
  nodes: Array<{
    id: number;
    name: string;
    category: string;
    status: string;
    priority: number;
    dependencies: number[];
  }>;
  edges: Array<{ source: number; target: number }>;
} {
  const passing_ids = new Set(features.filter((f) => f.passes).map((f) => f.id));

  const nodes = [];
  const edges = [];

  for (const f of features) {
    const deps = f.dependencies || [];
    const blocking = deps.filter((d) => !passing_ids.has(d));

    let status: string;
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

  return { nodes, edges };
}
