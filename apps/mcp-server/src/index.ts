import { DatabaseService } from '@myapp/api-core';
import type { ServerConfig } from '@myapp/shared-types';

const config: ServerConfig = {
  name: 'MCP Server',
  version: '0.0.0',
  database: {
    path: './data.db',
    verbose: process.env.NODE_ENV === 'development',
  },
};

console.log(`Starting ${config.name} v${config.version}...`);

const db = new DatabaseService(config.database);

// Initialize database
const initResult = db.initialize();
if (!initResult.success) {
  console.error('Failed to initialize database:', initResult.error);
  process.exit(1);
}

console.log('Database initialized successfully');

// Example usage
const addResult = db.addItem('Test Item');
if (addResult.success) {
  console.log('Added item with ID:', addResult.data?.id);
}

const itemsResult = db.getItems();
if (itemsResult.success) {
  console.log('Current items:', itemsResult.data);
}

db.close();
console.log('Server completed successfully');
