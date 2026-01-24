/**
 * Database Utilities
 * ==================
 *
 * TypeScript-specific utilities for database operations (not in Python)
 */

import type { ErrorInfo } from '@gcapnias/shared-types';
import { RETRY_DELAYS } from '@gcapnias/shared-types';

/**
 * Retry operation on SQLITE_BUSY errors
 * Uses exponential backoff: 100, 200, 400, 800, 1600ms
 * @param operation - Function to retry
 * @param operation_name - Name for logging
 * @returns Operation result
 */
export async function retry_on_busy<T>(operation: () => T, operation_name: string): Promise<T> {
  let last_error: Error | undefined;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    try {
      return operation();
    } catch (error) {
      last_error = error as Error;

      // Check if it's a SQLITE_BUSY error
      if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
        const delay = RETRY_DELAYS[attempt];

        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[${operation_name}] SQLITE_BUSY, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS.length})`
          );
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Not a busy error, throw immediately
      throw error;
    }
  }

  // All retries exhausted
  throw last_error;
}

/**
 * Parse SQLite error into structured ErrorInfo
 * @param error - Error from better-sqlite3
 * @returns Structured error info or null
 */
export function parse_sqlite_error(error: Error): ErrorInfo | null {
  const message = error.message.toLowerCase();

  if (message.includes('unique')) {
    return {
      code: 'CONFLICT_DUPLICATE_KEY',
      message: 'Duplicate key violation',
      details: error.message,
    };
  }

  if (message.includes('check constraint')) {
    return {
      code: 'CONFLICT_CONSTRAINT_VIOLATION',
      message: 'Check constraint violated',
      details: error.message,
    };
  }

  if (message.includes('foreign key')) {
    return {
      code: 'CONFLICT_FOREIGN_KEY',
      message: 'Foreign key constraint violated',
      details: error.message,
    };
  }

  if (message.includes('locked') || message.includes('busy')) {
    return {
      code: 'DATABASE_LOCK_TIMEOUT',
      message: 'Database is locked',
      details: error.message,
    };
  }

  return null;
}

/**
 * Convert any error to Result error format
 * @param error - Any caught error
 * @returns Result error object
 */
export function to_error_result(error: unknown): { success: false; error: ErrorInfo } {
  if (error instanceof Error) {
    const sqlite_error = parse_sqlite_error(error);
    if (sqlite_error) {
      return { success: false, error: sqlite_error };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        details: error.stack,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: String(error),
    },
  };
}

/**
 * Safely parse JSON array column
 * @param text - JSON string from database
 * @returns Parsed array or null
 */
export function parse_json_array<T>(text: string | null): T[] | null {
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Serialize array to JSON for database storage
 * @param arr - Array to serialize
 * @returns JSON string or null
 */
export function serialize_json_array<T>(arr: T[] | null): string | null {
  if (!arr || arr.length === 0) {
    return null;
  }

  return JSON.stringify(arr);
}
