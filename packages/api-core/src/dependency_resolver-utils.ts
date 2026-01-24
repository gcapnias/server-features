/**
 * Dependency Resolver Utilities
 * ==============================
 *
 * TypeScript-specific utilities for dependency graph operations (not in Python)
 */

import type { Feature } from '@gcapnias/shared-types';

/**
 * Build adjacency list representation of dependency graph
 * @param features - All features
 * @returns Map of feature_id → array of dependency IDs
 */
export function build_adjacency_list(features: Feature[]): Map<number, number[]> {
  const adjacency = new Map<number, number[]>();

  for (const feature of features) {
    const deps = feature.dependencies || [];
    adjacency.set(feature.id, deps);
  }

  return adjacency;
}

/**
 * Calculate depth of feature in dependency tree
 * Python recursion translated to iterative with memoization
 * @param feature_id - Feature to calculate depth for
 * @param graph - Adjacency list graph
 * @param memo - Memoization cache
 * @returns Depth (1 + max(depths of dependencies))
 */
export function compute_depth(
  feature_id: number,
  graph: Map<number, number[]>,
  memo: Map<number, number> = new Map()
): number {
  if (memo.has(feature_id)) {
    return memo.get(feature_id)!;
  }

  const deps = graph.get(feature_id) || [];
  if (deps.length === 0) {
    memo.set(feature_id, 0);
    return 0;
  }

  const max_dep_depth = Math.max(...deps.map((dep_id) => compute_depth(dep_id, graph, memo)));
  const depth = 1 + max_dep_depth;
  memo.set(feature_id, depth);

  return depth;
}

/**
 * Build reverse adjacency list (who depends on me)
 * @param features - All features
 * @returns Map of feature_id → array of dependent IDs
 */
export function build_reverse_adjacency(features: Feature[]): Map<number, number[]> {
  const reverse = new Map<number, number[]>(features.map((f) => [f.id, []]));

  for (const feature of features) {
    const deps = feature.dependencies || [];
    for (const dep_id of deps) {
      if (reverse.has(dep_id)) {
        reverse.get(dep_id)!.push(feature.id);
      }
    }
  }

  return reverse;
}
