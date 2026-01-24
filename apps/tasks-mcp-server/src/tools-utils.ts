/**
 * Utility functions for MCP tools
 *
 * Provides helper functions including file-based locking mechanism for priority
 * counter synchronization, JSON serialization, error formatting, and database
 * session management.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Lock file path for priority counter synchronization
 */
const LOCK_FILE_PATH = path.join(os.tmpdir(), 'feature-priority.lock');

/**
 * Maximum wait time for acquiring lock (in milliseconds)
 */
const LOCK_TIMEOUT = 5000;

/**
 * Poll interval when waiting for lock (in milliseconds)
 */
const LOCK_POLL_INTERVAL = 50;

/**
 * File descriptor for the lock file
 */
let lockFd: number | null = null;

/**
 * Acquire a file-based lock for priority counter operations
 *
 * Uses a file lock to prevent race conditions when assigning priorities
 * to features. This is equivalent to the Python threading.Lock().
 */
export function lockPriority(): void {
  const startTime = Date.now();

  while (true) {
    try {
      // Try to create the lock file exclusively
      lockFd = fs.openSync(LOCK_FILE_PATH, 'wx');
      return; // Lock acquired successfully
    } catch (error: any) {
      // Lock file already exists, wait and retry
      if (error.code === 'EEXIST') {
        const elapsed = Date.now() - startTime;
        if (elapsed >= LOCK_TIMEOUT) {
          // Check if lock file is stale (older than timeout)
          try {
            const stats = fs.statSync(LOCK_FILE_PATH);
            const age = Date.now() - stats.mtimeMs;
            if (age > LOCK_TIMEOUT) {
              // Stale lock file, remove it and retry
              fs.unlinkSync(LOCK_FILE_PATH);
              continue;
            }
          } catch {
            // Ignore errors checking stale lock
          }
          throw new Error('Failed to acquire priority lock: timeout');
        }
        // Wait before retrying
        sleepSync(LOCK_POLL_INTERVAL);
      } else {
        throw new Error(`Failed to acquire priority lock: ${error.message}`);
      }
    }
  }
}

/**
 * Release the file-based lock for priority counter operations
 */
export function unlockPriority(): void {
  if (lockFd !== null) {
    try {
      fs.closeSync(lockFd);
      lockFd = null;
    } catch (error) {
      // Ignore errors closing
    }
  }

  // Remove lock file
  try {
    fs.unlinkSync(LOCK_FILE_PATH);
  } catch (error) {
    // Ignore errors removing lock file
  }
}

/**
 * Synchronous sleep function (blocking)
 */
function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait
  }
}

/**
 * Get a database session
 *
 * This is a placeholder function that will be implemented in tools.ts
 * to access the global session maker.
 */
export function getSession() {
  throw new Error('getSession should be implemented in tools.ts');
}

/**
 * Format an error response as JSON string
 */
export function formatError(message: string): string {
  return JSON.stringify({ error: message });
}

/**
 * Format a success response as JSON string
 */
export function formatSuccess(data: any): string {
  return JSON.stringify({ success: true, ...data });
}

/**
 * Parse dependencies from database JSON string
 */
export function parseDependencies(deps: string | null): number[] | null {
  if (!deps) return null;
  try {
    return JSON.parse(deps);
  } catch {
    return null;
  }
}

/**
 * Parse steps from database JSON string
 */
export function parseSteps(steps: string | null): string[] {
  if (!steps) return [];
  try {
    return JSON.parse(steps);
  } catch {
    return [];
  }
}

/**
 * Convert database row to Feature object
 */
export function rowToFeature(row: any): any {
  return {
    id: row.id,
    priority: row.priority,
    category: row.category,
    name: row.name,
    description: row.description,
    steps: parseSteps(row.steps),
    passes: Boolean(row.passes),
    in_progress: Boolean(row.in_progress),
    dependencies: parseDependencies(row.dependencies),
  };
}

/**
 * Ensure database directory exists
 */
export function ensureDatabaseDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
