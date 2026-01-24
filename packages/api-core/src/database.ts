/**
 * Database Models and Connection
 * ==============================
 *
 * SQLite database schema for feature storage matching Python database.py
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import type {
  Feature as IFeature,
  Schedule as ISchedule,
  ScheduleOverride as IScheduleOverride,
} from '@gcapnias/shared-types';

/**
 * Session wrapper for database operations
 */
export class Session {
  constructor(public db: Database.Database) {}

  /**
   * Execute a query that returns rows
   */
  query<T>(sql: string, ...params: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute a statement that modifies data
   */
  execute(sql: string, ...params: any[]): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * Begin transaction
   */
  beginTransaction(): void {
    this.db.exec('BEGIN');
  }

  /**
   * Commit transaction
   */
  commit(): void {
    this.db.exec('COMMIT');
  }

  /**
   * Rollback transaction
   */
  rollback(): void {
    this.db.exec('ROLLBACK');
  }

  /**
   * Close session (no-op for better-sqlite3)
   */
  close(): void {
    // SQLite connections are managed at database level, not session
  }
}

/**
 * Feature class matching Python database.Feature
 * Preserves all SQLAlchemy model behavior
 */
export class Feature implements IFeature {
  id: number;
  priority: number;
  category: string;
  name: string;
  description: string;
  steps: string[];
  passes: boolean;
  in_progress: boolean;
  dependencies: number[] | null;

  constructor(data: Partial<IFeature>) {
    this.id = data.id ?? 0;
    this.priority = data.priority ?? 999;
    this.category = data.category ?? '';
    this.name = data.name ?? '';
    this.description = data.description ?? '';
    this.steps = data.steps ?? [];
    this.passes = data.passes ?? false;
    this.in_progress = data.in_progress ?? false;
    this.dependencies = data.dependencies ?? null;
  }

  /**
   * Convert to JSON-serializable dictionary
   * Python: def to_dict(self) -> dict
   */
  to_dict(): Record<string, any> {
    return {
      id: this.id,
      priority: this.priority,
      category: this.category,
      name: this.name,
      description: this.description,
      steps: this.steps,
      passes: this.passes ?? false,
      in_progress: this.in_progress ?? false,
      dependencies: this.dependencies ?? [],
    };
  }

  /**
   * Safely extract dependencies as list
   * Python: def get_dependencies_safe(self) -> list[int]
   */
  get_dependencies_safe(): number[] {
    if (this.dependencies === null) {
      return [];
    }
    if (Array.isArray(this.dependencies)) {
      return this.dependencies.filter((d) => typeof d === 'number');
    }
    return [];
  }
}

/**
 * Schedule class matching Python database.Schedule
 */
export class Schedule implements ISchedule {
  id: number;
  project_name: string;
  start_time: string;
  duration_minutes: number;
  days_of_week: number;
  enabled: boolean;
  yolo_mode: boolean;
  model: string | null;
  max_concurrency: number;
  crash_count: number;
  created_at: Date;

  constructor(data: Partial<ISchedule>) {
    this.id = data.id ?? 0;
    this.project_name = data.project_name ?? '';
    this.start_time = data.start_time ?? '00:00';
    this.duration_minutes = data.duration_minutes ?? 60;
    this.days_of_week = data.days_of_week ?? 127;
    this.enabled = data.enabled ?? true;
    this.yolo_mode = data.yolo_mode ?? false;
    this.model = data.model ?? null;
    this.max_concurrency = data.max_concurrency ?? 3;
    this.crash_count = data.crash_count ?? 0;
    this.created_at = data.created_at ?? new Date();
  }

  /**
   * Convert to JSON-serializable dictionary
   * Python: def to_dict(self) -> dict
   */
  to_dict(): Record<string, any> {
    return {
      id: this.id,
      project_name: this.project_name,
      start_time: this.start_time,
      duration_minutes: this.duration_minutes,
      days_of_week: this.days_of_week,
      enabled: this.enabled,
      yolo_mode: this.yolo_mode,
      model: this.model,
      max_concurrency: this.max_concurrency,
      crash_count: this.crash_count,
      created_at: this.created_at.toISOString(),
    };
  }

  /**
   * Check if schedule is active on given weekday
   * Python: def is_active_on_day(self, weekday: int) -> bool
   * @param weekday - Day of week (0=Monday, 6=Sunday)
   */
  is_active_on_day(weekday: number): boolean {
    const day_bit = 1 << weekday;
    return Boolean(this.days_of_week & day_bit);
  }
}

/**
 * ScheduleOverride class matching Python database.ScheduleOverride
 */
export class ScheduleOverride implements IScheduleOverride {
  id: number;
  schedule_id: number;
  override_type: 'start' | 'stop';
  expires_at: Date;
  created_at: Date;

  constructor(data: Partial<IScheduleOverride>) {
    this.id = data.id ?? 0;
    this.schedule_id = data.schedule_id ?? 0;
    this.override_type = data.override_type ?? 'start';
    this.expires_at = data.expires_at ?? new Date();
    this.created_at = data.created_at ?? new Date();
  }

  /**
   * Convert to JSON-serializable dictionary
   * Python: def to_dict(self) -> dict
   */
  to_dict(): Record<string, any> {
    return {
      id: this.id,
      schedule_id: this.schedule_id,
      override_type: this.override_type,
      expires_at: this.expires_at.toISOString(),
      created_at: this.created_at.toISOString(),
    };
  }
}

/**
 * Get current UTC timestamp
 * Python: def utcnow() -> datetime
 * Replacement for deprecated SQLAlchemy func.now()
 */
export function utcnow(): Date {
  return new Date();
}

/**
 * Get path to features.db
 * Python: def get_database_path() -> Path
 * @returns Absolute path to database file
 */
export function get_database_path(project_dir?: string): string {
  const dir = project_dir || process.cwd();
  return path.join(dir, 'features.db');
}

/**
 * Get database connection URL/path
 * Python: def get_database_url() -> str
 * @returns SQLite connection string with POSIX-style paths
 */
export function get_database_url(project_dir?: string): string {
  const db_path = get_database_path(project_dir);
  // Convert to POSIX-style for cross-platform compatibility
  return db_path.replace(/\\/g, '/');
}

/**
 * Add in_progress column to legacy databases
 * Python: def _migrate_add_in_progress_column(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function _migrate_add_in_progress_column(db: Database.Database): void {
  const columns = db.pragma('table_info(features)') as Array<{ name: string }>;
  const column_names = columns.map((c) => c.name);

  if (!column_names.includes('in_progress')) {
    db.exec('ALTER TABLE features ADD COLUMN in_progress BOOLEAN DEFAULT 0');
  }
}

/**
 * Fix NULL values in boolean columns
 * Python: def _migrate_fix_null_boolean_fields(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function _migrate_fix_null_boolean_fields(db: Database.Database): void {
  db.exec('UPDATE features SET passes = 0 WHERE passes IS NULL');
  db.exec('UPDATE features SET in_progress = 0 WHERE in_progress IS NULL');
}

/**
 * Add dependencies TEXT column
 * Python: def _migrate_add_dependencies_column(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function _migrate_add_dependencies_column(db: Database.Database): void {
  const columns = db.pragma('table_info(features)') as Array<{ name: string }>;
  const column_names = columns.map((c) => c.name);

  if (!column_names.includes('dependencies')) {
    db.exec('ALTER TABLE features ADD COLUMN dependencies TEXT DEFAULT NULL');
  }
}

/**
 * Legacy no-op migration function
 * Python: def _migrate_add_testing_columns(engine) -> None
 * Kept for backwards compatibility
 */
function _migrate_add_testing_columns(db: Database.Database): void {
  // No-op, originally added removed columns
}

/**
 * Detect network filesystems (UNC, NFS, SMB, CIFS)
 * Python: def _is_network_path(path: str) -> bool
 * Note: TypeScript function name must be 'detect_network_filesystem()'
 * @param path - Filesystem path to check
 * @returns True if path is on network filesystem
 */
export function _is_network_path(filepath: string): boolean {
  const path_str = path.resolve(filepath);

  if (os.platform() === 'win32') {
    // Windows UNC paths: \\server\share or \\?\UNC\server\share
    if (path_str.startsWith('\\\\')) {
      return true;
    }
    // Note: Detecting mapped network drives requires Windows API
    // For simplicity, we only check UNC paths
  } else {
    // Unix: Check /proc/mounts for network filesystem types
    try {
      const fs = require('fs');
      const mounts = fs.readFileSync('/proc/mounts', 'utf-8');

      for (const line of mounts.split('\n')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const mount_point = parts[1];
          const fs_type = parts[2];

          if (path_str.startsWith(mount_point)) {
            if (['nfs', 'nfs4', 'cifs', 'smbfs', 'fuse.sshfs'].includes(fs_type)) {
              return true;
            }
          }
        }
      }
    } catch (error) {
      // /proc/mounts not available or permission denied
    }
  }

  return false;
}

/**
 * Create schedules and schedule_overrides tables
 * Python: def _migrate_add_schedules_tables(engine) -> None
 * @param db - better-sqlite3 Database instance
 */
function _migrate_add_schedules_tables(db: Database.Database): void {
  // Create schedules table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      days_of_week INTEGER NOT NULL DEFAULT 127,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      yolo_mode BOOLEAN NOT NULL DEFAULT 0,
      model TEXT,
      max_concurrency INTEGER NOT NULL DEFAULT 3,
      crash_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      CHECK (duration_minutes >= 1 AND duration_minutes <= 1440),
      CHECK (days_of_week >= 0 AND days_of_week <= 127),
      CHECK (max_concurrency >= 1 AND max_concurrency <= 5),
      CHECK (crash_count >= 0)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS ix_schedules_project_name ON schedules(project_name)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_schedules_enabled ON schedules(enabled)');

  // Create schedule_overrides table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      override_type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    )
  `);

  // Add missing columns for upgrades
  const columns = db.pragma('table_info(schedules)') as Array<{ name: string }>;
  const column_names = columns.map((c) => c.name);

  if (!column_names.includes('crash_count')) {
    db.exec('ALTER TABLE schedules ADD COLUMN crash_count INTEGER DEFAULT 0');
  }

  if (!column_names.includes('max_concurrency')) {
    db.exec('ALTER TABLE schedules ADD COLUMN max_concurrency INTEGER DEFAULT 3');
  }
}

/**
 * Initialize database connection
 * Python: def create_database(db_path: str | None = None) -> tuple[Engine, sessionmaker]
 * @param db_path - Optional path to database file (defaults to features.db in cwd)
 * @returns Tuple of [Database instance, session factory]
 */
export function create_database(db_path?: string): {
  engine: Database.Database;
  session_maker: () => Session;
} {
  const path = db_path || get_database_path();

  const db = new Database(path, {
    timeout: 30000, // 30s timeout for locks
  });

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority INTEGER NOT NULL DEFAULT 999,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      steps TEXT NOT NULL,
      passes BOOLEAN NOT NULL DEFAULT 0,
      in_progress BOOLEAN NOT NULL DEFAULT 0,
      dependencies TEXT DEFAULT NULL
    )
  `);

  // Create indexes
  db.exec('CREATE INDEX IF NOT EXISTS ix_features_priority ON features(priority)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_features_passes ON features(passes)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_features_in_progress ON features(in_progress)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_feature_status ON features(passes, in_progress)');

  // Choose journal mode based on filesystem type
  const is_network = _is_network_path(path);
  const journal_mode = is_network ? 'DELETE' : 'WAL';
  db.pragma(`journal_mode = ${journal_mode}`);
  db.pragma('busy_timeout = 30000');

  // Run migrations
  _migrate_add_in_progress_column(db);
  _migrate_fix_null_boolean_fields(db);
  _migrate_add_dependencies_column(db);
  _migrate_add_testing_columns(db);
  _migrate_add_schedules_tables(db);

  // Session factory
  const session_maker = () => new Session(db);

  return { engine: db, session_maker };
}

// Global session maker - will be set when server starts
let _session_maker: (() => Session) | null = null;

/**
 * Set global session maker
 * Python: def set_session_maker(session_maker: sessionmaker) -> None
 * @param session_maker - Session factory function
 */
export function set_session_maker(session_maker: () => Session): void {
  _session_maker = session_maker;
}

/**
 * FastAPI/dependency injection session provider
 * Python: def get_db() -> Generator[Session, None, None]
 * Note: TypeScript function name must be 'get_database_session()'
 * @returns Database session with automatic cleanup
 * @throws RuntimeError if session maker not initialized
 */
export function* get_db(): Generator<Session, void, unknown> {
  if (_session_maker === null) {
    throw new Error('Database not initialized. Call set_session_maker first.');
  }

  const session = _session_maker();
  try {
    yield session;
  } finally {
    session.close();
  }
}
