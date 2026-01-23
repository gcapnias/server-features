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
