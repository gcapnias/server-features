/**
 * Integration test to verify the feature_create tool works with the exact input
 * from the user's error report.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, feature_create } from '../tools';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('feature_create - User Reported Issue', () => {
  const TEST_DB_PATH = path.join(__dirname, 'test-user-issue.db');

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

  it('should handle the exact input from the user error report', () => {
    // This is the exact input that caused the error:
    // "Cannot read properties of undefined (reading '_zod')"
    const input = {
      category: 'functional',
      name: 'App loads without errors',
      description:
        'Application starts successfully, renders the main layout with header, and shows no console errors',
      steps: [
        'Navigate to http://localhost:5173',
        'Verify page loads within 3 seconds',
        'Check browser console for zero errors',
        'Verify header with title displays',
        'Verify theme toggle button is visible',
      ],
    };

    // Call feature_create with the exact parameters
    const result = feature_create(input.category, input.name, input.description, input.steps);

    // Verify the result
    expect(result).toBeDefined();
    expect(() => JSON.parse(result)).not.toThrow();

    const parsed = JSON.parse(result);

    // Should succeed, not return an error
    expect(parsed).toHaveProperty('success', true);
    expect(parsed).toHaveProperty('feature');
    expect(parsed.feature.category).toBe('functional');
    expect(parsed.feature.name).toBe('App loads without errors');
    expect(parsed.feature.steps).toHaveLength(5);

    console.log("✅ feature_create works correctly with the user's input!");
    console.log('Result:', JSON.stringify(parsed, null, 2));
  });
});
