/**
 * Dependency Resolver Tests
 * ==========================
 *
 * Tests for dependency_resolver.ts matching Python test structure
 */

import { describe, it, expect } from 'vitest';
import {
  resolve_dependencies,
  are_dependencies_satisfied,
  get_blocking_dependencies,
  would_create_circular_dependency,
  validate_dependencies,
  _detect_cycles,
  compute_scheduling_scores,
  get_ready_features,
  get_blocked_features,
  build_graph_data,
} from '../dependency_resolver';
import { Feature } from '../database';
import { MAX_DEPENDENCY_DEPTH, MAX_DEPENDENCIES } from '@gcapnias/shared-types';

describe('dependency_resolver', () => {
  describe('resolve_dependencies', () => {
    it('should sort features by dependencies', () => {
      const features: Feature[] = [
        new Feature({ id: 1, priority: 1, dependencies: null }),
        new Feature({ id: 2, priority: 2, dependencies: [1] }),
        new Feature({ id: 3, priority: 3, dependencies: [1, 2] }),
      ];

      const result = resolve_dependencies(features);

      expect(result.ordered_features.length).toBe(3);
      expect(result.ordered_features[0].id).toBe(1);
      expect(result.circular_dependencies.length).toBe(0);
    });

    it('should detect circular dependencies', () => {
      const features: Feature[] = [
        new Feature({ id: 1, dependencies: [2] }),
        new Feature({ id: 2, dependencies: [3] }),
        new Feature({ id: 3, dependencies: [1] }),
      ];

      const result = resolve_dependencies(features);

      expect(result.circular_dependencies.length).toBeGreaterThan(0);
    });

    it('should respect priority ordering', () => {
      const features: Feature[] = [
        new Feature({ id: 1, priority: 10, dependencies: null }),
        new Feature({ id: 2, priority: 5, dependencies: null }),
        new Feature({ id: 3, priority: 1, dependencies: null }),
      ];

      const result = resolve_dependencies(features);

      // Lower priority number = higher priority = comes first
      expect(result.ordered_features[0].id).toBe(3);
      expect(result.ordered_features[1].id).toBe(2);
      expect(result.ordered_features[2].id).toBe(1);
    });

    it('should detect missing dependencies', () => {
      const features: Feature[] = [
        new Feature({ id: 1, dependencies: [999] }), // 999 doesn't exist
      ];

      const result = resolve_dependencies(features);

      expect(result.missing_dependencies.has(1)).toBe(true);
      expect(result.missing_dependencies.get(1)).toContain(999);
    });

    it('should track blocked features', () => {
      const features: Feature[] = [
        new Feature({ id: 1, passes: false, dependencies: null }),
        new Feature({ id: 2, passes: false, dependencies: [1] }),
      ];

      const result = resolve_dependencies(features);

      expect(result.blocked_features.has(2)).toBe(true);
      expect(result.blocked_features.get(2)).toContain(1);
    });
  });

  describe('are_dependencies_satisfied', () => {
    it('should return true for features with no deps', () => {
      const feature = new Feature({ id: 1, dependencies: null });
      const passing_ids = new Set<number>();

      expect(are_dependencies_satisfied(feature, passing_ids)).toBe(true);
    });

    it('should return false if dependencies incomplete', () => {
      const feature = new Feature({ id: 2, dependencies: [1] });
      const passing_ids = new Set<number>();

      expect(are_dependencies_satisfied(feature, passing_ids)).toBe(false);
    });

    it('should return true if all dependencies complete', () => {
      const feature = new Feature({ id: 2, dependencies: [1] });
      const passing_ids = new Set<number>([1]);

      expect(are_dependencies_satisfied(feature, passing_ids)).toBe(true);
    });
  });

  describe('would_create_circular_dependency', () => {
    it('should detect self-reference', () => {
      const features: Feature[] = [];

      expect(would_create_circular_dependency(features, 1, 1)).toBe(true);
    });

    it('should detect direct cycles', () => {
      const features: Feature[] = [
        new Feature({ id: 1, dependencies: [2] }),
        new Feature({ id: 2, dependencies: null }),
      ];

      // Adding 1 as dependency of 2 would create cycle (1→2, 2→1)
      expect(would_create_circular_dependency(features, 2, 1)).toBe(true);
    });

    it('should detect indirect cycles', () => {
      const features: Feature[] = [
        new Feature({ id: 1, dependencies: [2] }),
        new Feature({ id: 2, dependencies: [3] }),
        new Feature({ id: 3, dependencies: null }),
      ];

      // Adding 1 as dependency of 3 would create cycle (1→2→3, 3→1)
      expect(would_create_circular_dependency(features, 3, 1)).toBe(true);
    });

    it('should return false for valid dependencies', () => {
      const features: Feature[] = [
        new Feature({ id: 1, dependencies: null }),
        new Feature({ id: 2, dependencies: [1] }),
      ];

      // Adding 1 as dependency of 3 is valid
      expect(would_create_circular_dependency(features, 3, 1)).toBe(false);
    });
  });

  describe('validate_dependencies', () => {
    it('should enforce MAX_DEPENDENCIES limit', () => {
      const deps = Array.from({ length: MAX_DEPENDENCIES + 1 }, (_, i) => i + 1);
      const all_ids = new Set(deps);

      const [valid, error] = validate_dependencies(999, deps, all_ids);

      expect(valid).toBe(false);
      expect(error).toContain('Maximum');
    });

    it('should detect self-reference', () => {
      const [valid, error] = validate_dependencies(1, [1, 2], new Set([1, 2]));

      expect(valid).toBe(false);
      expect(error).toContain('itself');
    });

    it('should detect missing feature IDs', () => {
      const [valid, error] = validate_dependencies(1, [999], new Set([1, 2, 3]));

      expect(valid).toBe(false);
      expect(error).toContain('not found');
    });

    it('should detect duplicates', () => {
      const [valid, error] = validate_dependencies(1, [2, 2], new Set([1, 2]));

      expect(valid).toBe(false);
      expect(error).toContain('Duplicate');
    });

    it('should return [true, ""] for valid deps', () => {
      const [valid, error] = validate_dependencies(1, [2, 3], new Set([1, 2, 3]));

      expect(valid).toBe(true);
      expect(error).toBe('');
    });
  });

  describe('get_ready_features', () => {
    it('should return features ready for work', () => {
      const features: Feature[] = [
        new Feature({ id: 1, passes: true, dependencies: null }),
        new Feature({ id: 2, passes: false, in_progress: false, dependencies: [1] }),
        new Feature({ id: 3, passes: false, in_progress: false, dependencies: [999] }),
      ];

      const ready = get_ready_features(features);

      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe(2);
    });

    it('should sort by priority', () => {
      const features: Feature[] = [
        new Feature({ id: 1, priority: 10, passes: false, dependencies: null }),
        new Feature({ id: 2, priority: 5, passes: false, dependencies: null }),
        new Feature({ id: 3, priority: 1, passes: false, dependencies: null }),
      ];

      const ready = get_ready_features(features);

      expect(ready[0].id).toBe(3); // Lower priority number comes first
      expect(ready[1].id).toBe(2);
      expect(ready[2].id).toBe(1);
    });

    it('should respect limit parameter', () => {
      const features: Feature[] = Array.from(
        { length: 20 },
        (_, i) => new Feature({ id: i + 1, passes: false, dependencies: null })
      );

      const ready = get_ready_features(features, 5);

      expect(ready.length).toBe(5);
    });
  });

  describe('get_blocked_features', () => {
    it('should return blocked features with blocking info', () => {
      const features: Feature[] = [
        new Feature({ id: 1, passes: false, dependencies: null }),
        new Feature({ id: 2, passes: false, dependencies: [1] }),
        new Feature({ id: 3, passes: false, dependencies: [1, 2] }),
      ];

      const blocked = get_blocked_features(features);

      expect(blocked.length).toBe(2);
      expect(blocked.find((f) => f.id === 2)?.blocked_by).toContain(1);
      expect(blocked.find((f) => f.id === 3)?.blocked_by).toContain(1);
      expect(blocked.find((f) => f.id === 3)?.blocked_by).toContain(2);
    });

    it('should exclude passing features', () => {
      const features: Feature[] = [
        new Feature({ id: 1, passes: true, dependencies: null }),
        new Feature({ id: 2, passes: false, dependencies: [1] }),
      ];

      const blocked = get_blocked_features(features);

      expect(blocked.length).toBe(0);
    });
  });

  describe('build_graph_data', () => {
    it('should build graph with nodes and edges', () => {
      const features: Feature[] = [
        new Feature({
          id: 1,
          name: 'Feature 1',
          category: 'cat1',
          passes: true,
          dependencies: null,
        }),
        new Feature({
          id: 2,
          name: 'Feature 2',
          category: 'cat1',
          passes: false,
          dependencies: [1],
        }),
      ];

      const graph = build_graph_data(features);

      expect(graph.nodes.length).toBe(2);
      expect(graph.edges.length).toBe(1);
      expect(graph.nodes[0].status).toBe('done');
      expect(graph.edges[0].source).toBe(1);
      expect(graph.edges[0].target).toBe(2);
    });

    it('should correctly identify status', () => {
      const features: Feature[] = [
        new Feature({ id: 1, passes: true, dependencies: null }),
        new Feature({ id: 2, passes: false, in_progress: true, dependencies: [1] }),
        new Feature({ id: 3, passes: false, in_progress: false, dependencies: [1] }),
        new Feature({ id: 4, passes: false, in_progress: false, dependencies: [999] }),
      ];

      const graph = build_graph_data(features);

      expect(graph.nodes.find((n) => n.id === 1)?.status).toBe('done');
      expect(graph.nodes.find((n) => n.id === 2)?.status).toBe('in_progress');
      expect(graph.nodes.find((n) => n.id === 3)?.status).toBe('pending');
      expect(graph.nodes.find((n) => n.id === 4)?.status).toBe('blocked');
    });
  });
});
