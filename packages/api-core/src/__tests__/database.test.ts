/**
 * Database Tests
 * ==============
 *
 * Tests for database.ts matching Python test structure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  create_database,
  get_database_path,
  get_database_url,
  Feature,
  Schedule,
  ScheduleOverride,
  _is_network_path,
  utcnow,
} from '../database';

describe('database', () => {
  describe('utcnow', () => {
    it('should return current UTC time', () => {
      const now = utcnow();
      expect(now).toBeInstanceOf(Date);
      expect(Date.now() - now.getTime()).toBeLessThan(1000);
    });
  });

  describe('get_database_path', () => {
    it('should return absolute path to features.db', () => {
      const path = get_database_path();
      expect(path).toContain('features.db');
    });

    it('should use custom directory when provided', () => {
      const path = get_database_path('/custom/dir');
      expect(path).toBe('/custom/dir/features.db');
    });
  });

  describe('get_database_url', () => {
    it('should return SQLite connection string with POSIX paths', () => {
      const url = get_database_url();
      expect(url).toContain('features.db');
      expect(url).not.toContain('\\\\');
    });
  });

  describe('create_database', () => {
    let db: Database.Database;

    afterEach(() => {
      if (db) {
        db.close();
      }
    });

    it('should create in-memory database', () => {
      const result = create_database(':memory:');
      db = result.engine;

      expect(db).toBeDefined();
      expect(result.session_maker).toBeDefined();
    });

    it('should run migrations successfully', () => {
      const result = create_database(':memory:');
      db = result.engine;

      // Check that features table exists
      const tables = db.pragma('table_list') as Array<{ name: string }>;
      const table_names = tables.map((t) => t.name);

      expect(table_names).toContain('features');
      expect(table_names).toContain('schedules');
      expect(table_names).toContain('schedule_overrides');
    });

    it('should have correct indexes', () => {
      const result = create_database(':memory:');
      db = result.engine;

      const indexes = db.pragma('index_list(features)') as Array<{ name: string }>;
      const index_names = indexes.map((i) => i.name);

      expect(index_names.some((n) => n.includes('priority'))).toBe(true);
      expect(index_names.some((n) => n.includes('passes'))).toBe(true);
    });
  });

  describe('Feature class', () => {
    it('should convert to dict via to_dict()', () => {
      const feature = new Feature({
        id: 1,
        priority: 10,
        category: 'test',
        name: 'Test Feature',
        description: 'Test description',
        steps: ['step1', 'step2'],
        passes: true,
        in_progress: false,
        dependencies: [2, 3],
      });

      const dict = feature.to_dict();

      expect(dict.id).toBe(1);
      expect(dict.priority).toBe(10);
      expect(dict.category).toBe('test');
      expect(dict.name).toBe('Test Feature');
      expect(dict.steps).toEqual(['step1', 'step2']);
      expect(dict.dependencies).toEqual([2, 3]);
    });

    it('should safely extract dependencies', () => {
      const feature1 = new Feature({ dependencies: [1, 2, 3] });
      expect(feature1.get_dependencies_safe()).toEqual([1, 2, 3]);

      const feature2 = new Feature({ dependencies: null });
      expect(feature2.get_dependencies_safe()).toEqual([]);
    });
  });

  describe('Schedule class', () => {
    it('should convert to dict via to_dict()', () => {
      const schedule = new Schedule({
        id: 1,
        project_name: 'test-project',
        start_time: '09:00',
        duration_minutes: 120,
        days_of_week: 127,
        enabled: true,
        yolo_mode: false,
        model: 'gpt-4',
        max_concurrency: 3,
        crash_count: 0,
        created_at: new Date('2024-01-01T00:00:00Z'),
      });

      const dict = schedule.to_dict();

      expect(dict.id).toBe(1);
      expect(dict.project_name).toBe('test-project');
      expect(dict.start_time).toBe('09:00');
      expect(dict.duration_minutes).toBe(120);
    });

    it('should check if active on given day', () => {
      // All days enabled (127 = 0b1111111)
      const schedule = new Schedule({ days_of_week: 127 });

      expect(schedule.is_active_on_day(0)).toBe(true); // Monday
      expect(schedule.is_active_on_day(6)).toBe(true); // Sunday

      // Only weekdays (31 = 0b0011111 = Mon-Fri)
      const weekday_schedule = new Schedule({ days_of_week: 31 });

      expect(weekday_schedule.is_active_on_day(0)).toBe(true); // Monday
      expect(weekday_schedule.is_active_on_day(4)).toBe(true); // Friday
      expect(weekday_schedule.is_active_on_day(5)).toBe(false); // Saturday
      expect(weekday_schedule.is_active_on_day(6)).toBe(false); // Sunday
    });
  });

  describe('_is_network_path', () => {
    it('should detect UNC paths on Windows', () => {
      if (process.platform === 'win32') {
        expect(_is_network_path('\\\\server\\share')).toBe(true);
      }
    });

    it('should return false for local paths', () => {
      expect(_is_network_path('/tmp')).toBe(false);

      if (process.platform === 'win32') {
        expect(_is_network_path('C:\\Users')).toBe(false);
      }
    });
  });
});
