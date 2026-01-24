/**
 * JSON to SQLite Migration
 * ========================
 *
 * Automatically migrates existing feature_list.json files to SQLite database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Session, Feature, Schedule, ScheduleOverride, create_database } from './database';

/**
 * Import feature_list.json to SQLite database
 * Python: def migrate_json_to_sqlite(project_dir: Path, session_maker: sessionmaker) -> bool
 *
 * Skips if database already has data.
 * Handles both old and new JSON formats.
 * Automatically backs up JSON with timestamp.
 *
 * @param project_dir - Directory containing the project (defaults to cwd)
 * @param session_maker - Optional session maker (creates if not provided)
 * @returns True if migration was performed, False if skipped
 */
export function migrate_json_to_sqlite(
  project_dir?: string,
  session_maker?: () => Session
): boolean {
  const dir = project_dir || process.cwd();
  const json_file = path.join(dir, 'feature_list.json');

  if (!fs.existsSync(json_file)) {
    return false; // No JSON file to migrate
  }

  // Create database and session maker if not provided
  const { session_maker: maker } = session_maker
    ? { session_maker }
    : create_database(path.join(dir, 'features.db'));
  const session = maker();

  try {
    // Check if database already has data
    const existing_count =
      session.query<{ count: number }>('SELECT COUNT(*) as count FROM features')[0]?.count || 0;

    if (existing_count > 0) {
      console.log(`Database already has ${existing_count} features, skipping migration`);
      return false;
    }
  } finally {
    session.close();
  }

  // Load JSON data
  let features_data: any[];
  try {
    const json_content = fs.readFileSync(json_file, 'utf-8');
    features_data = JSON.parse(json_content);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error parsing feature_list.json: ${error.message}`);
    }
    return false;
  }

  if (!Array.isArray(features_data)) {
    console.error('Error: feature_list.json must contain a JSON array');
    return false;
  }

  // Import features into database
  const import_session = maker();
  try {
    import_session.beginTransaction();

    let imported_count = 0;
    for (let i = 0; i < features_data.length; i++) {
      const feature_dict = features_data[i];

      // Handle both old format (no id/priority/name) and new format
      const feature = new Feature({
        id: feature_dict.id ?? i + 1,
        priority: feature_dict.priority ?? i + 1,
        category: feature_dict.category ?? 'uncategorized',
        name: feature_dict.name ?? `Feature ${i + 1}`,
        description: feature_dict.description ?? '',
        steps: feature_dict.steps ?? [],
        passes: feature_dict.passes ?? false,
        in_progress: feature_dict.in_progress ?? false,
        dependencies: feature_dict.dependencies ?? null,
      });

      // Insert into database
      const steps_json = JSON.stringify(feature.steps);
      const deps_json = feature.dependencies ? JSON.stringify(feature.dependencies) : null;

      import_session.execute(
        `INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress, dependencies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        feature.id,
        feature.priority,
        feature.category,
        feature.name,
        feature.description,
        steps_json,
        feature.passes ? 1 : 0,
        feature.in_progress ? 1 : 0,
        deps_json
      );

      imported_count++;
    }

    import_session.commit();

    // Verify import
    const final_count =
      import_session.query<{ count: number }>('SELECT COUNT(*) as count FROM features')[0]?.count ||
      0;
    console.log(`Migrated ${final_count} features from JSON to SQLite`);
  } catch (error) {
    import_session.rollback();
    if (error instanceof Error) {
      console.error(`Error during migration: ${error.message}`);
    }
    return false;
  } finally {
    import_session.close();
  }

  // Rename JSON file to backup
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  const backup_file = path.join(dir, `feature_list.json.backup.${timestamp}`);

  try {
    fs.renameSync(json_file, backup_file);
    console.log(`Original JSON backed up to: ${path.basename(backup_file)}`);
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Warning: Could not backup JSON file: ${error.message}`);
    }
    // Continue anyway - the data is in the database
  }

  return true;
}

/**
 * Export database to JSON file
 * Python: def export_to_json(project_dir: Path, session_maker: sessionmaker, output_file: Optional[Path] = None) -> Path
 *
 * Default output: feature_list_export.json
 * Sorts by priority, then id
 *
 * @param project_dir - Directory containing the project (defaults to cwd)
 * @param session_maker - Optional session maker (creates if not provided)
 * @param output_path - Optional output file path
 * @returns Path to exported JSON file
 */
export function export_to_json(
  project_dir?: string,
  session_maker?: () => Session,
  output_path?: string
): string {
  const dir = project_dir || process.cwd();
  const output_file = output_path || path.join(dir, 'feature_list_export.json');

  // Create database and session maker if not provided
  const { session_maker: maker } = session_maker
    ? { session_maker }
    : create_database(path.join(dir, 'features.db'));
  const session = maker();

  try {
    // Get all features sorted by priority, then id
    const features_raw = session.query<any>('SELECT * FROM features ORDER BY priority ASC, id ASC');

    // Convert to Feature objects and then to dicts
    const features_data = features_raw.map((row) => {
      const feature = new Feature({
        id: row.id,
        priority: row.priority,
        category: row.category,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps || '[]'),
        passes: Boolean(row.passes),
        in_progress: Boolean(row.in_progress),
        dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
      });
      return feature.to_dict();
    });

    // Write to file
    fs.writeFileSync(output_file, JSON.stringify(features_data, null, 2), 'utf-8');

    console.log(`Exported ${features_data.length} features to ${output_file}`);
    return output_file;
  } finally {
    session.close();
  }
}
