/**
 * Integration test to verify the feature_create_bulk tool works with
 * a realistic dataset from features_to_create.json
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, feature_create_bulk } from '../tools';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('feature_create_bulk', () => {
  const TEST_DB_PATH = path.join(__dirname, 'test-bulk-create.db');
  const FEATURES_JSON_PATH = path.join(__dirname, 'features_to_create.json');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Initialize database
    initializeDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    // Close database connection
    closeDatabase();

    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should create multiple features from features_to_create.json', () => {
    // Load features from JSON file
    const featuresData = JSON.parse(fs.readFileSync(FEATURES_JSON_PATH, 'utf-8'));

    expect(featuresData).toBeInstanceOf(Array);
    expect(featuresData.length).toBeGreaterThan(0);

    // Call feature_create_bulk with the features
    const result = feature_create_bulk(featuresData);

    // Verify the result
    expect(result).toBeDefined();
    expect(() => JSON.parse(result)).not.toThrow();

    const parsed = JSON.parse(result);

    // Should succeed, not return an error
    expect(parsed).not.toHaveProperty('error');
    expect(parsed).toHaveProperty('created');
    expect(parsed).toHaveProperty('with_dependencies');
    expect(parsed.created).toBe(featuresData.length);

    console.log(`✅ feature_create_bulk created ${parsed.created} features successfully!`);
  });

  it('should handle features with dependencies correctly', () => {
    // Load features from JSON file
    const featuresData = JSON.parse(fs.readFileSync(FEATURES_JSON_PATH, 'utf-8'));

    // Find features with dependencies
    const featuresWithDeps = featuresData.filter(
      (f: any) => f.depends_on_indices && f.depends_on_indices.length > 0
    );

    expect(featuresWithDeps.length).toBeGreaterThan(0);

    // Call feature_create_bulk
    const result = feature_create_bulk(featuresData);
    const parsed = JSON.parse(result);

    expect(parsed).not.toHaveProperty('error');
    expect(parsed.with_dependencies).toBe(featuresWithDeps.length);

    console.log(`✅ ${parsed.with_dependencies} features have dependencies properly set!`);
  });

  it('should create the correct number of features', () => {
    // Load features from JSON file
    const featuresData = JSON.parse(fs.readFileSync(FEATURES_JSON_PATH, 'utf-8'));

    // Call feature_create_bulk
    const result = feature_create_bulk(featuresData);
    const parsed = JSON.parse(result);

    expect(parsed).not.toHaveProperty('error');
    expect(parsed.created).toBe(featuresData.length);

    console.log(`✅ Created ${parsed.created} features from JSON file!`);
  });

  it('should return error for invalid data', () => {
    // Create invalid features (missing required fields)
    const invalidFeatures = [
      {
        category: 'test',
        name: 'Valid Feature',
        description: 'A valid feature',
        steps: ['Step 1'],
      },
      {
        category: 'test',
        name: 'Invalid Feature',
        // Missing description and steps
      },
    ];

    // Call feature_create_bulk with invalid data
    const result = feature_create_bulk(invalidFeatures as any);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty('error');
    expect(parsed.error).toContain('missing required fields');

    console.log(`✅ Correctly rejected invalid feature data!`);
  });
});
