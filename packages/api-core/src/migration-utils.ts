/**
 * Migration Utilities
 * ===================
 *
 * TypeScript-specific utilities for file operations (not in Python)
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Create timestamped backup of JSON file
 * @param json_path - Path to JSON file
 * @returns Path to backup file
 */
export function create_backup(json_path: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');

  const backup_path = `${json_path}.backup.${timestamp}`;
  fs.copyFileSync(json_path, backup_path);

  return backup_path;
}

/**
 * Safely read JSON file with error handling
 * @param filepath - Path to JSON file
 * @returns Parsed JSON data
 * @throws Error if file cannot be read or parsed
 */
export function read_json_safe(filepath: string): any {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read JSON file ${filepath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Ensure directory exists, create if needed
 * @param dirpath - Directory path
 */
export function ensure_directory_exists(dirpath: string): void {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
}

/**
 * Write JSON file with pretty formatting
 * @param filepath - Path to output file
 * @param data - Data to serialize
 */
export function write_json(filepath: string, data: any): void {
  ensure_directory_exists(path.dirname(filepath));
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}
