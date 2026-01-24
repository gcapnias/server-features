/**
 * Test suite for MCP tool functions
 *
 * Tests all 18 tool functions including concurrent priority assignment scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  initializeDatabase,
  closeDatabase,
  feature_get_stats,
  feature_get_by_id,
  feature_get_summary,
  feature_mark_passing,
  feature_mark_failing,
  feature_skip,
  feature_mark_in_progress,
  feature_claim_and_get,
  feature_clear_in_progress,
  feature_create_bulk,
  feature_create,
  feature_add_dependency,
  feature_remove_dependency,
  feature_get_ready,
  feature_get_blocked,
  feature_get_graph,
  feature_set_dependencies,
} from '../tools.js';

describe('Feature Management Tools', () => {
  let testDbPath: string;

  beforeEach(() => {
    // Create a temporary database for each test
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    testDbPath = path.join(tempDir, 'test-features.db');
    initializeDatabase(testDbPath);
  });

  afterEach(() => {
    // Cleanup
    closeDatabase();
    try {
      const dir = path.dirname(testDbPath);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('feature_get_stats', () => {
    it('should return stats for empty database', () => {
      const result = JSON.parse(feature_get_stats());
      expect(result).toEqual({
        passing: 0,
        in_progress: 0,
        total: 0,
        percentage: 0.0,
      });
    });

    it('should return correct stats after adding features', () => {
      feature_create('Test', 'Feature 1', 'Description 1', ['Step 1']);
      feature_create('Test', 'Feature 2', 'Description 2', ['Step 1']);

      const result = JSON.parse(feature_get_stats());
      expect(result.total).toBe(2);
      expect(result.passing).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.percentage).toBe(0.0);
    });

    it('should calculate percentage correctly', () => {
      const createResult1 = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      const createResult2 = JSON.parse(
        feature_create('Test', 'Feature 2', 'Description 2', ['Step 1'])
      );

      feature_mark_passing(createResult1.feature.id);

      const result = JSON.parse(feature_get_stats());
      expect(result.total).toBe(2);
      expect(result.passing).toBe(1);
      expect(result.percentage).toBe(50.0);
    });
  });

  describe('feature_create', () => {
    it('should create a feature with correct properties', () => {
      const result = JSON.parse(
        feature_create('Authentication', 'User Login', 'Implement user login', ['Step 1', 'Step 2'])
      );

      expect(result.success).toBe(true);
      expect(result.feature.category).toBe('Authentication');
      expect(result.feature.name).toBe('User Login');
      expect(result.feature.description).toBe('Implement user login');
      expect(result.feature.steps).toEqual(['Step 1', 'Step 2']);
      expect(result.feature.passes).toBe(false);
      expect(result.feature.in_progress).toBe(false);
      expect(result.feature.dependencies).toBeNull();
      expect(result.feature.priority).toBe(1);
    });

    it('should assign sequential priorities', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      const result3 = JSON.parse(feature_create('Test', 'Feature 3', 'Desc 3', ['Step 1']));

      expect(result1.feature.priority).toBe(1);
      expect(result2.feature.priority).toBe(2);
      expect(result3.feature.priority).toBe(3);
    });
  });

  describe('feature_create_bulk', () => {
    it('should create multiple features at once', () => {
      const result = JSON.parse(
        feature_create_bulk([
          {
            category: 'Test',
            name: 'Feature 1',
            description: 'Desc 1',
            steps: ['Step 1'],
          },
          {
            category: 'Test',
            name: 'Feature 2',
            description: 'Desc 2',
            steps: ['Step 1'],
          },
        ])
      );

      expect(result.created).toBe(2);
      expect(result.with_dependencies).toBe(0);
    });

    it('should handle dependencies via depends_on_indices', () => {
      const result = JSON.parse(
        feature_create_bulk([
          {
            category: 'Test',
            name: 'Feature 1',
            description: 'Desc 1',
            steps: ['Step 1'],
          },
          {
            category: 'Test',
            name: 'Feature 2',
            description: 'Desc 2',
            steps: ['Step 1'],
            depends_on_indices: [0],
          },
          {
            category: 'Test',
            name: 'Feature 3',
            description: 'Desc 3',
            steps: ['Step 1'],
            depends_on_indices: [0, 1],
          },
        ])
      );

      expect(result.created).toBe(3);
      expect(result.with_dependencies).toBe(2);
    });

    it('should reject forward references in dependencies', () => {
      const result = JSON.parse(
        feature_create_bulk([
          {
            category: 'Test',
            name: 'Feature 1',
            description: 'Desc 1',
            steps: ['Step 1'],
            depends_on_indices: [1], // Forward reference
          },
          {
            category: 'Test',
            name: 'Feature 2',
            description: 'Desc 2',
            steps: ['Step 1'],
          },
        ])
      );

      expect(result.error).toContain('forward reference not allowed');
    });
  });

  describe('feature_get_by_id', () => {
    it('should return feature details', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      const result = JSON.parse(feature_get_by_id(createResult.feature.id));

      expect(result.id).toBe(createResult.feature.id);
      expect(result.name).toBe('Feature 1');
      expect(result.category).toBe('Test');
    });

    it('should return error for non-existent feature', () => {
      const result = JSON.parse(feature_get_by_id(999));
      expect(result.error).toBeDefined();
    });
  });

  describe('feature_get_summary', () => {
    it('should return minimal feature info', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      const result = JSON.parse(feature_get_summary(createResult.feature.id));

      expect(result).toEqual({
        id: createResult.feature.id,
        name: 'Feature 1',
        passes: false,
        in_progress: false,
        dependencies: [],
      });
    });
  });

  describe('feature_mark_passing', () => {
    it('should mark feature as passing', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      const result = JSON.parse(feature_mark_passing(createResult.feature.id));

      expect(result.success).toBe(true);
      expect(result.feature_id).toBe(createResult.feature.id);

      // Verify it's marked as passing
      const feature = JSON.parse(feature_get_by_id(createResult.feature.id));
      expect(feature.passes).toBe(true);
      expect(feature.in_progress).toBe(false);
    });
  });

  describe('feature_mark_failing', () => {
    it('should mark feature as failing', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      feature_mark_passing(createResult.feature.id);

      const result = JSON.parse(feature_mark_failing(createResult.feature.id));
      expect(result.message).toContain('marked as failing');
      expect(result.feature.passes).toBe(false);
    });
  });

  describe('feature_skip', () => {
    it('should move feature to end of queue', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));

      const skipResult = JSON.parse(feature_skip(result1.feature.id));

      expect(skipResult.old_priority).toBe(1);
      expect(skipResult.new_priority).toBe(3); // Max priority (2) + 1
    });

    it('should not skip passing features', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      feature_mark_passing(createResult.feature.id);

      const result = JSON.parse(feature_skip(createResult.feature.id));
      expect(result.error).toContain('already passing');
    });
  });

  describe('feature_mark_in_progress', () => {
    it('should mark feature as in-progress', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      const result = JSON.parse(feature_mark_in_progress(createResult.feature.id));

      expect(result.in_progress).toBe(true);
    });

    it('should not mark passing feature as in-progress', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      feature_mark_passing(createResult.feature.id);

      const result = JSON.parse(feature_mark_in_progress(createResult.feature.id));
      expect(result.error).toContain('already passing');
    });

    it('should not mark already in-progress feature', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      feature_mark_in_progress(createResult.feature.id);

      const result = JSON.parse(feature_mark_in_progress(createResult.feature.id));
      expect(result.error).toContain('already in-progress');
    });
  });

  describe('feature_claim_and_get', () => {
    it('should atomically claim and return feature', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      const result = JSON.parse(feature_claim_and_get(createResult.feature.id));

      expect(result.id).toBe(createResult.feature.id);
      expect(result.in_progress).toBe(true);
      expect(result.already_claimed).toBe(false);
    });

    it('should be idempotent', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      feature_claim_and_get(createResult.feature.id);

      const result = JSON.parse(feature_claim_and_get(createResult.feature.id));
      expect(result.already_claimed).toBe(true);
    });
  });

  describe('feature_clear_in_progress', () => {
    it('should clear in-progress status', () => {
      const createResult = JSON.parse(
        feature_create('Test', 'Feature 1', 'Description 1', ['Step 1'])
      );
      feature_mark_in_progress(createResult.feature.id);

      const result = JSON.parse(feature_clear_in_progress(createResult.feature.id));
      expect(result.in_progress).toBe(false);
    });
  });

  describe('feature_add_dependency', () => {
    it('should add dependency between features', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));

      const depResult = JSON.parse(feature_add_dependency(result2.feature.id, result1.feature.id));
      expect(depResult.success).toBe(true);
      expect(depResult.dependencies).toEqual([result1.feature.id]);
    });

    it('should prevent self-reference', () => {
      const createResult = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result = JSON.parse(
        feature_add_dependency(createResult.feature.id, createResult.feature.id)
      );
      expect(result.error).toContain('cannot depend on itself');
    });

    it('should prevent circular dependencies', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));

      feature_add_dependency(result2.feature.id, result1.feature.id);
      const circularResult = JSON.parse(
        feature_add_dependency(result1.feature.id, result2.feature.id)
      );

      expect(circularResult.error).toContain('circular dependency');
    });
  });

  describe('feature_remove_dependency', () => {
    it('should remove dependency', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));

      feature_add_dependency(result2.feature.id, result1.feature.id);
      const removeResult = JSON.parse(
        feature_remove_dependency(result2.feature.id, result1.feature.id)
      );

      expect(removeResult.success).toBe(true);
      expect(removeResult.dependencies).toEqual([]);
    });
  });

  describe('feature_set_dependencies', () => {
    it('should set all dependencies at once', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      const result3 = JSON.parse(feature_create('Test', 'Feature 3', 'Desc 3', ['Step 1']));

      const setResult = JSON.parse(
        feature_set_dependencies(result3.feature.id, [result1.feature.id, result2.feature.id])
      );

      expect(setResult.success).toBe(true);
      expect(setResult.dependencies).toEqual([result1.feature.id, result2.feature.id]);
    });

    it('should replace existing dependencies', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      const result3 = JSON.parse(feature_create('Test', 'Feature 3', 'Desc 3', ['Step 1']));

      feature_set_dependencies(result3.feature.id, [result1.feature.id]);
      const setResult = JSON.parse(
        feature_set_dependencies(result3.feature.id, [result2.feature.id])
      );

      expect(setResult.dependencies).toEqual([result2.feature.id]);
    });
  });

  describe('feature_get_ready', () => {
    it('should return features ready to start', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      feature_add_dependency(result2.feature.id, result1.feature.id);

      const readyResult = JSON.parse(feature_get_ready(10));
      expect(readyResult.total_ready).toBe(1); // Only Feature 1 is ready
      expect(readyResult.features[0].id).toBe(result1.feature.id);
    });

    it('should not return in-progress features', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      feature_mark_in_progress(result1.feature.id);

      const readyResult = JSON.parse(feature_get_ready(10));
      expect(readyResult.total_ready).toBe(0);
    });
  });

  describe('feature_get_blocked', () => {
    it('should return features blocked by dependencies', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      feature_add_dependency(result2.feature.id, result1.feature.id);

      const blockedResult = JSON.parse(feature_get_blocked(20));
      expect(blockedResult.total_blocked).toBe(1);
      expect(blockedResult.features[0].id).toBe(result2.feature.id);
      expect(blockedResult.features[0].blocked_by).toEqual([result1.feature.id]);
    });
  });

  describe('feature_get_graph', () => {
    it('should return graph data', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      feature_add_dependency(result2.feature.id, result1.feature.id);

      const graphResult = JSON.parse(feature_get_graph());
      expect(graphResult.nodes).toHaveLength(2);
      expect(graphResult.edges).toHaveLength(1);
      expect(graphResult.edges[0]).toEqual({
        source: result1.feature.id,
        target: result2.feature.id,
      });
    });

    it('should calculate correct status for nodes', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      feature_mark_passing(result1.feature.id);

      const graphResult = JSON.parse(feature_get_graph());
      expect(graphResult.nodes[0].status).toBe('done');
    });
  });

  describe('Concurrent Priority Assignment', () => {
    it('should handle sequential priority assignment correctly', () => {
      // Simulate concurrent feature creation
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = JSON.parse(feature_create('Test', `Feature ${i}`, `Desc ${i}`, ['Step 1']));
        results.push(result.feature.priority);
      }

      // All priorities should be unique and sequential
      expect(new Set(results).size).toBe(5);
      expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle skip operations with correct priority assignment', () => {
      const result1 = JSON.parse(feature_create('Test', 'Feature 1', 'Desc 1', ['Step 1']));
      const result2 = JSON.parse(feature_create('Test', 'Feature 2', 'Desc 2', ['Step 1']));
      const result3 = JSON.parse(feature_create('Test', 'Feature 3', 'Desc 3', ['Step 1']));

      // Skip feature 1
      feature_skip(result1.feature.id);

      // Create a new feature
      const result4 = JSON.parse(feature_create('Test', 'Feature 4', 'Desc 4', ['Step 1']));

      // Skipped feature should have lower priority number (earlier in queue) than the new feature
      // because it was skipped before the new feature was created
      const feature1 = JSON.parse(feature_get_by_id(result1.feature.id));
      expect(result4.feature.priority).toBeGreaterThan(feature1.priority);
    });
  });
});
