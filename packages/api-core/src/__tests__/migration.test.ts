/**
 * Migration Tests
 * ===============
 *
 * Tests for migration.ts matching Python test structure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { migrate_json_to_sqlite, export_to_json } from '../migration';
import { create_database, Feature } from '../database';

describe('migration', () => {
  const base_temp_dir = path.join(process.cwd(), 'test-temp');
  let test_dir: string;

  beforeEach(() => {
    // Create unique subdirectory inside test-temp for each test to avoid conflicts
    test_dir = path.join(
      base_temp_dir,
      `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    if (!fs.existsSync(test_dir)) {
      fs.mkdirSync(test_dir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory with retry for Windows file locks
    if (fs.existsSync(test_dir)) {
      try {
        fs.rmSync(test_dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (err) {
        // Ignore cleanup errors - temp directories will be cleaned eventually
        console.warn(`Failed to clean up ${test_dir}:`, err);
      }
    }
  });

  describe('migrate_json_to_sqlite', () => {
    it('should skip migration if no JSON file exists', () => {
      const result = migrate_json_to_sqlite(test_dir);
      expect(result).toBe(false);
    });

    it('should skip migration if database has data', () => {
      // Create database with data
      const db_path = path.join(test_dir, 'features.db');
      const { engine, session_maker } = create_database(db_path);
      const session = session_maker();

      session.execute(
        'INSERT INTO features (priority, category, name, description, steps, passes, in_progress) VALUES (?, ?, ?, ?, ?, ?, ?)',
        1,
        'test',
        'Test',
        'Test',
        '[]',
        0,
        0
      );
      session.close();
      engine.close();

      // Create JSON file
      const json_path = path.join(test_dir, 'feature_list.json');
      fs.writeFileSync(
        json_path,
        JSON.stringify([
          {
            id: 2,
            priority: 2,
            category: 'test',
            name: 'Feature 2',
            description: 'Test',
            steps: [],
          },
        ])
      );

      const result = migrate_json_to_sqlite(test_dir);
      expect(result).toBe(false);
      expect(fs.existsSync(json_path)).toBe(true); // JSON not backed up
    });

    it('should import features from JSON', () => {
      // Create JSON file
      const json_path = path.join(test_dir, 'feature_list.json');
      const features_data = [
        {
          id: 1,
          priority: 1,
          category: 'cat1',
          name: 'Feature 1',
          description: 'Desc 1',
          steps: ['step1'],
          passes: false,
          in_progress: false,
        },
        {
          id: 2,
          priority: 2,
          category: 'cat2',
          name: 'Feature 2',
          description: 'Desc 2',
          steps: ['step2'],
          passes: true,
          in_progress: false,
          dependencies: [1],
        },
      ];
      fs.writeFileSync(json_path, JSON.stringify(features_data));

      const result = migrate_json_to_sqlite(test_dir);

      expect(result).toBe(true);

      // Verify features were imported
      const db_path = path.join(test_dir, 'features.db');
      const { engine, session_maker } = create_database(db_path);
      const session = session_maker();

      const features = session.query<any>('SELECT * FROM features ORDER BY id');

      expect(features.length).toBe(2);
      expect(features[0].name).toBe('Feature 1');
      expect(features[1].name).toBe('Feature 2');

      session.close();
      engine.close();
    });

    it('should create timestamped backup', () => {
      // Create JSON file
      const json_path = path.join(test_dir, 'feature_list.json');
      fs.writeFileSync(
        json_path,
        JSON.stringify([
          { id: 1, priority: 1, category: 'test', name: 'Test', description: 'Test', steps: [] },
        ])
      );

      migrate_json_to_sqlite(test_dir);

      // Check that backup was created
      const files = fs.readdirSync(test_dir);
      const backup_files = files.filter((f) => f.startsWith('feature_list.json.backup.'));

      expect(backup_files.length).toBe(1);
      expect(fs.existsSync(json_path)).toBe(false); // Original JSON moved
    });

    it('should return true when migration performed', () => {
      const json_path = path.join(test_dir, 'feature_list.json');
      fs.writeFileSync(
        json_path,
        JSON.stringify([
          { id: 1, priority: 1, category: 'test', name: 'Test', description: 'Test', steps: [] },
        ])
      );

      const result = migrate_json_to_sqlite(test_dir);
      expect(result).toBe(true);
    });
  });

  describe('export_to_json', () => {
    it('should export all features sorted by priority', () => {
      // Create database with features
      const db_path = path.join(test_dir, 'features.db');
      const { engine, session_maker } = create_database(db_path);
      const session = session_maker();

      session.execute(
        'INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        3,
        30,
        'cat3',
        'Feature 3',
        'Desc 3',
        '["step3"]',
        0,
        0
      );
      session.execute(
        'INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        1,
        10,
        'cat1',
        'Feature 1',
        'Desc 1',
        '["step1"]',
        0,
        0
      );
      session.execute(
        'INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        2,
        20,
        'cat2',
        'Feature 2',
        'Desc 2',
        '["step2"]',
        0,
        0
      );

      session.close();

      const output_path = export_to_json(test_dir, session_maker);

      expect(fs.existsSync(output_path)).toBe(true);

      const exported = JSON.parse(fs.readFileSync(output_path, 'utf-8'));

      expect(exported.length).toBe(3);
      expect(exported[0].id).toBe(1); // Sorted by priority (10, 20, 30)
      expect(exported[1].id).toBe(2);
      expect(exported[2].id).toBe(3);

      // Close database and allow it to flush
      engine.close();
      // Small delay to ensure Windows releases the file lock
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    });

    it('should return output file path', () => {
      const db_path = path.join(test_dir, 'features.db');
      const { engine, session_maker } = create_database(db_path);

      const output_path = export_to_json(test_dir, session_maker);

      expect(output_path).toContain('feature_list_export.json');

      // Close database and allow it to flush
      engine.close();
      // Small delay to ensure Windows releases the file lock
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    });
  });
});
