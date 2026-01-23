import Database from 'better-sqlite3';
import type { DatabaseConfig, ApiResponse } from '@myapp/shared-types';

/**
 * Core API functionality with SQLite database integration
 */
export class DatabaseService {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path, {
      verbose: config.verbose ? console.log : undefined,
    });

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Initialize database schema
   */
  initialize(): ApiResponse {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all items from database
   */
  getItems(): ApiResponse<Array<{ id: number; name: string; created_at: number }>> {
    try {
      const stmt = this.db.prepare('SELECT * FROM items ORDER BY created_at DESC');
      const data = stmt.all() as Array<{ id: number; name: string; created_at: number }>;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add a new item to the database
   */
  addItem(name: string): ApiResponse<{ id: number }> {
    try {
      const stmt = this.db.prepare('INSERT INTO items (name) VALUES (?)');
      const info = stmt.run(name);
      return { success: true, data: { id: Number(info.lastInsertRowid) } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
