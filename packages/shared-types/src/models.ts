/**
 * Shared models matching Python database.py SQLAlchemy models
 */

/**
 * Feature model matching Python database.Feature
 */
export interface Feature {
  id: number;
  priority: number;
  category: string;
  name: string;
  description: string;
  steps: string[];
  passes: boolean;
  in_progress: boolean;
  dependencies: number[] | null;
}

/**
 * Schedule model matching Python database.Schedule
 */
export interface Schedule {
  id: number;
  project_name: string;
  start_time: string; // "HH:MM" format
  duration_minutes: number;
  days_of_week: number; // bitfield 0-127
  enabled: boolean;
  yolo_mode: boolean;
  model: string | null;
  max_concurrency: number;
  crash_count: number;
  created_at: Date;
}

/**
 * ScheduleOverride model matching Python database.ScheduleOverride
 */
export interface ScheduleOverride {
  id: number;
  schedule_id: number;
  override_type: 'start' | 'stop';
  expires_at: Date;
  created_at: Date;
}

/**
 * DependencyResult TypedDict from Python dependency_resolver
 */
export interface DependencyResult {
  ordered_features: Feature[];
  circular_dependencies: number[][];
  blocked_features: Map<number, number[]>;
  missing_dependencies: Map<number, number[]>;
}

/**
 * Error information for Result types
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Result type for operations that can fail
 */
export type Result<T> = { success: true; data: T } | { success: false; error: ErrorInfo };
