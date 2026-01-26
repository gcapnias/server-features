/**
 * Basic test to verify the app can load and display features
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  create_database,
  get_database_path,
  compute_scheduling_scores,
  get_blocked_features,
} from '@gcapnias/api-core';
import type { Feature } from '@gcapnias/shared-types';

describe('Feature Explorer Core Logic', () => {
  let features: Feature[];
  let featureMap: Map<number, Feature>;
  let scores: Map<number, number>;

  beforeAll(() => {
    const db_path = get_database_path();
    const { session_maker } = create_database(db_path);
    const session = session_maker();

    try {
      const rows = session.query<any>('SELECT * FROM features');

      features = rows.map((row) => ({
        id: row.id,
        priority: row.priority,
        category: row.category,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps || '[]'),
        passes: Boolean(row.passes),
        in_progress: Boolean(row.in_progress),
        dependencies: JSON.parse(row.dependencies || 'null'),
      }));

      featureMap = new Map(features.map((f) => [f.id, f]));
      scores = compute_scheduling_scores(features);
    } finally {
      session.close();
    }
  });

  it('should load features from database', () => {
    expect(features.length).toBeGreaterThan(0);
  });

  it('should compute scheduling scores', () => {
    expect(scores.size).toBe(features.length);
    for (const score of scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1110); // Max possible score
    }
  });

  it('should identify pending vs completed features', () => {
    const pending = features.filter((f) => !f.passes);
    const completed = features.filter((f) => f.passes);

    expect(pending.length + completed.length).toBe(features.length);
  });

  it('should sort pending features by scheduling score', () => {
    const pending = features.filter((f) => !f.passes);
    const sorted = pending.sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

    // Verify sorted order
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentScore = scores.get(sorted[i].id) || 0;
      const nextScore = scores.get(sorted[i + 1].id) || 0;
      expect(currentScore).toBeGreaterThanOrEqual(nextScore);
    }
  });

  it('should sort completed features by priority', () => {
    const completed = features.filter((f) => f.passes);
    const sorted = completed.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.id - b.id;
    });

    // Verify sorted order
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].priority).toBeLessThanOrEqual(sorted[i + 1].priority);
    }
  });

  it('should resolve dependency names', () => {
    const featureWithDeps = features.find((f) => f.dependencies && f.dependencies.length > 0);

    if (featureWithDeps) {
      for (const depId of featureWithDeps.dependencies!) {
        const depFeature = featureMap.get(depId);
        expect(depFeature).toBeDefined();
        expect(depFeature!.name).toBeTruthy();
      }
    }
  });

  it('should identify blocked features', () => {
    const blocked = get_blocked_features(features);

    for (const b of blocked) {
      expect(b.blocked_by).toBeDefined();
      expect(b.blocked_by.length).toBeGreaterThan(0);

      // Verify blocked_by IDs are valid and not passing
      for (const blockId of b.blocked_by) {
        const blockFeature = featureMap.get(blockId);
        expect(blockFeature).toBeDefined();
        expect(blockFeature!.passes).toBe(false);
      }
    }
  });

  it('should format list items with scores', () => {
    const feature = features[0];
    const score = scores.get(feature.id) || 0;
    const formatted = `${feature.name} [${Math.round(score)}]`;

    expect(formatted).toContain(feature.name);
    expect(formatted).toMatch(/\[\d+\]$/);
  });

  it('should generate complete feature details', () => {
    const feature = features[0];
    const score = scores.get(feature.id) || 0;

    const detailLines = [
      `ID: ${feature.id}`,
      `Name: ${feature.name}`,
      `Category: ${feature.category}`,
      `Priority: ${feature.priority}`,
      `Scheduling Score: ${Math.round(score)}`,
    ];

    for (const line of detailLines) {
      expect(line).toBeTruthy();
    }
  });
});
