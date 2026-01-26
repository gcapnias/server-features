/**
 * Initialize test database with sample features
 */

import { create_database, get_database_path } from '@gcapnias/api-core';

function main() {
  const db_path = get_database_path();
  console.log(`Initializing database at: ${db_path}`);

  const { engine, session_maker } = create_database(db_path);
  const session = session_maker();

  try {
    // Check if features already exist
    const existing = session.query<any>('SELECT COUNT(*) as count FROM features');
    if (existing[0].count > 0) {
      console.log(`Database already has ${existing[0].count} features`);
      return;
    }

    // Insert sample features
    const features = [
      {
        priority: 1,
        category: 'core',
        name: 'Database Setup',
        description: 'Initialize SQLite database with schema',
        steps: JSON.stringify(['Design schema', 'Create tables', 'Add indexes']),
        passes: true,
        in_progress: false,
        dependencies: null,
      },
      {
        priority: 2,
        category: 'core',
        name: 'Configuration System',
        description: 'Implement configuration management',
        steps: JSON.stringify(['Load config files', 'Validate settings', 'Add defaults']),
        passes: true,
        in_progress: false,
        dependencies: JSON.stringify([1]),
      },
      {
        priority: 3,
        category: 'core',
        name: 'Authentication System',
        description: 'Implement secure user authentication',
        steps: JSON.stringify([
          'Design auth flow',
          'Implement JWT tokens',
          'Add password hashing',
          'Create login endpoint',
        ]),
        passes: false,
        in_progress: true,
        dependencies: JSON.stringify([1, 2]),
      },
      {
        priority: 4,
        category: 'api',
        name: 'REST API Framework',
        description: 'Set up Express.js API server',
        steps: JSON.stringify(['Install dependencies', 'Create routes', 'Add middleware']),
        passes: false,
        in_progress: false,
        dependencies: JSON.stringify([2]),
      },
      {
        priority: 5,
        category: 'features',
        name: 'User Profile Management',
        description: 'Allow users to manage their profiles',
        steps: JSON.stringify([
          'Create profile model',
          'Add CRUD endpoints',
          'Implement validation',
        ]),
        passes: false,
        in_progress: false,
        dependencies: JSON.stringify([3, 4]),
      },
      {
        priority: 6,
        category: 'features',
        name: 'Email Notification Service',
        description: 'Send email notifications to users',
        steps: JSON.stringify(['Choose email provider', 'Create templates', 'Add sending logic']),
        passes: false,
        in_progress: false,
        dependencies: JSON.stringify([2]),
      },
      {
        priority: 7,
        category: 'features',
        name: 'File Upload System',
        description: 'Handle file uploads securely',
        steps: JSON.stringify(['Configure storage', 'Add validation', 'Implement endpoints']),
        passes: false,
        in_progress: false,
        dependencies: JSON.stringify([4]),
      },
      {
        priority: 8,
        category: 'testing',
        name: 'Integration Tests',
        description: 'Write comprehensive integration tests',
        steps: JSON.stringify(['Set up test framework', 'Write API tests', 'Add CI pipeline']),
        passes: false,
        in_progress: false,
        dependencies: JSON.stringify([4, 5]),
      },
    ];

    for (const feature of features) {
      session.execute(
        `INSERT INTO features (priority, category, name, description, steps, passes, in_progress, dependencies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        feature.priority,
        feature.category,
        feature.name,
        feature.description,
        feature.steps,
        feature.passes ? 1 : 0,
        feature.in_progress ? 1 : 0,
        feature.dependencies
      );
    }

    console.log(`✅ Created ${features.length} sample features`);
    console.log('Run the explorer: pnpm --filter @gcapnias/feature-explorer start');
  } finally {
    session.close();
  }
}

main();
