import {
  create_database,
  Feature,
  migrate_json_to_sqlite,
  get_ready_features,
} from '@gcapnias/api-core';
import type { ServerConfig } from '@gcapnias/shared-types';

const config: ServerConfig = {
  name: 'MCP Server',
  version: '0.0.0',
  database: {
    path: './data.db',
    verbose: process.env.NODE_ENV === 'development',
  },
};

console.log(`Starting ${config.name} v${config.version}...`);

// Create database with migrated Python API
const { engine, session_maker } = create_database(config.database.path);

console.log('Database initialized successfully');

// Attempt to migrate from JSON if exists
const migrated = migrate_json_to_sqlite(process.cwd(), session_maker);
if (migrated) {
  console.log('Migrated features from JSON to SQLite');
}

// Example: Get ready features
const session = session_maker();
try {
  const all_features_raw = session.query<any>('SELECT * FROM features');
  const all_features = all_features_raw.map(
    (row) =>
      new Feature({
        id: row.id,
        priority: row.priority,
        category: row.category,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps || '[]'),
        passes: Boolean(row.passes),
        in_progress: Boolean(row.in_progress),
        dependencies: row.dependencies ? JSON.parse(row.dependencies) : null,
      })
  );

  const ready = get_ready_features(all_features, 5);
  console.log(`Found ${ready.length} ready features`);

  if (ready.length > 0) {
    console.log('Top ready features:');
    ready.forEach((f) => console.log(`  - [${f.id}] ${f.name} (priority: ${f.priority})`));
  }
} finally {
  session.close();
}

engine.close();
console.log('Server completed successfully');
