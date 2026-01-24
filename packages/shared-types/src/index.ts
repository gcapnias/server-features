/**
 * Shared type definitions for the MCP server monorepo
 */

export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
}

export interface ServerConfig {
  name: string;
  version: string;
  database: DatabaseConfig;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Export models and constants from Python API migration
export * from './models';
export * from './constants';
