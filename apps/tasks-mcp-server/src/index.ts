/**
 * MCP Server for Feature Management
 * ==================================
 *
 * Provides tools to manage features in the autonomous coding system.
 *
 * Tools:
 * - feature_get_stats: Get progress statistics
 * - feature_get_by_id: Get a specific feature by ID
 * - feature_get_summary: Get minimal feature info (id, name, status, deps)
 * - feature_mark_passing: Mark a feature as passing
 * - feature_mark_failing: Mark a feature as failing (regression detected)
 * - feature_skip: Skip a feature (move to end of queue)
 * - feature_mark_in_progress: Mark a feature as in-progress
 * - feature_claim_and_get: Atomically claim and get feature details
 * - feature_clear_in_progress: Clear in-progress status
 * - feature_create_bulk: Create multiple features at once
 * - feature_create: Create a single feature
 * - feature_add_dependency: Add a dependency between features
 * - feature_remove_dependency: Remove a dependency
 * - feature_get_ready: Get features ready to implement
 * - feature_get_blocked: Get features blocked by dependencies
 * - feature_get_graph: Get the dependency graph
 * - feature_set_dependencies: Set all dependencies at once
 *
 * Note: Feature selection (which feature to work on) is handled by the
 * orchestrator, not by agents. Agents receive pre-assigned feature IDs.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import express from 'express';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import {
  initializeDatabase,
  closeDatabase,
  feature_get_stats,
  feature_get_by_id,
  feature_get_summary,
  feature_mark_passing,
  feature_mark_failing,
  feature_skip,
  feature_mark_in_progress,
  feature_claim_and_get,
  feature_clear_in_progress,
  feature_create_bulk,
  feature_create,
  feature_add_dependency,
  feature_remove_dependency,
  feature_get_ready,
  feature_get_blocked,
  feature_get_graph,
  feature_set_dependencies,
} from './tools.js';
import {
  GetByIdInput,
  MarkPassingInput,
  MarkFailingInput,
  SkipFeatureInput,
  MarkInProgressInput,
  ClaimAndGetInput,
  ClearInProgressInput,
  BulkCreateInput,
  CreateFeatureInput,
  AddDependencyInput,
  RemoveDependencyInput,
  SetDependenciesInput,
  GetReadyInput,
  GetBlockedInput,
} from './schemas.js';

// Configuration from environment
const PROJECT_DIR = process.env.PROJECT_DIR || '.';
const DB_PATH = path.join(PROJECT_DIR, 'features.db');

// Initialize database
initializeDatabase(DB_PATH);

// Create MCP server
const server = new McpServer({
  name: 'features',
  version: '1.0.0',
});

/**
 * Register all 18 tools with the MCP server
 */

// Tool 1: feature_get_stats
server.registerTool(
  'feature_get_stats',
  {
    title: 'Get Feature Statistics',
    description:
      'Get statistics about feature completion progress. Returns passing, in-progress, total, and percentage.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = feature_get_stats();
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 2: feature_get_by_id
server.registerTool(
  'feature_get_by_id',
  {
    title: 'Get Feature By ID',
    description: 'Get a specific feature by its ID with full details',
    inputSchema: z.object({
      feature_id: z.number().int().min(1).describe('The ID of the feature to retrieve'),
    }),
  },
  async ({ feature_id }) => {
    const result = feature_get_by_id(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 3: feature_get_summary
server.registerTool(
  'feature_get_summary',
  {
    title: 'Get Feature Summary',
    description: 'Get minimal feature info: id, name, status, and dependencies only',
    inputSchema: z.object({
      feature_id: z.number().int().min(1).describe('The ID of the feature'),
    }),
  },
  async ({ feature_id }) => {
    const result = feature_get_summary(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 4: feature_mark_passing
server.registerTool(
  'feature_mark_passing',
  {
    title: 'Mark Feature as Passing',
    description: 'Mark a feature as passing after successful implementation',
    inputSchema: MarkPassingInput,
  },
  async ({ feature_id }) => {
    const result = feature_mark_passing(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 5: feature_mark_failing
server.registerTool(
  'feature_mark_failing',
  {
    title: 'Mark Feature as Failing',
    description: 'Mark a feature as failing after finding a regression',
    inputSchema: MarkFailingInput,
  },
  async ({ feature_id }) => {
    const result = feature_mark_failing(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 6: feature_skip
server.registerTool(
  'feature_skip',
  {
    title: 'Skip Feature',
    description: 'Skip a feature by moving it to the end of the priority queue',
    inputSchema: SkipFeatureInput,
  },
  async ({ feature_id }) => {
    const result = feature_skip(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 7: feature_mark_in_progress
server.registerTool(
  'feature_mark_in_progress',
  {
    title: 'Mark Feature In Progress',
    description: 'Mark a feature as in-progress to prevent other agents from working on it',
    inputSchema: MarkInProgressInput,
  },
  async ({ feature_id }) => {
    const result = feature_mark_in_progress(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 8: feature_claim_and_get
server.registerTool(
  'feature_claim_and_get',
  {
    title: 'Claim and Get Feature',
    description: 'Atomically claim a feature (mark in-progress) and return its full details',
    inputSchema: ClaimAndGetInput,
  },
  async ({ feature_id }) => {
    const result = feature_claim_and_get(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 9: feature_clear_in_progress
server.registerTool(
  'feature_clear_in_progress',
  {
    title: 'Clear In Progress Status',
    description: 'Clear in-progress status from a feature',
    inputSchema: ClearInProgressInput,
  },
  async ({ feature_id }) => {
    const result = feature_clear_in_progress(feature_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 10: feature_create_bulk
server.registerTool(
  'feature_create_bulk',
  {
    title: 'Create Multiple Features',
    description: 'Create multiple features in a single operation with dependencies',
    inputSchema: BulkCreateInput,
  },
  async ({ features }) => {
    const result = feature_create_bulk(features);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 11: feature_create
server.registerTool(
  'feature_create',
  {
    title: 'Create Single Feature',
    description: 'Create a single feature in the project backlog',
    inputSchema: CreateFeatureInput,
  },
  async ({ category, name, description, steps }) => {
    const result = feature_create(category, name, description, steps);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 12: feature_add_dependency
server.registerTool(
  'feature_add_dependency',
  {
    title: 'Add Dependency',
    description: 'Add a dependency relationship between features',
    inputSchema: AddDependencyInput,
  },
  async ({ feature_id, dependency_id }) => {
    const result = feature_add_dependency(feature_id, dependency_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 13: feature_remove_dependency
server.registerTool(
  'feature_remove_dependency',
  {
    title: 'Remove Dependency',
    description: 'Remove a dependency from a feature',
    inputSchema: RemoveDependencyInput,
  },
  async ({ feature_id, dependency_id }) => {
    const result = feature_remove_dependency(feature_id, dependency_id);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 14: feature_get_ready
server.registerTool(
  'feature_get_ready',
  {
    title: 'Get Ready Features',
    description: 'Get all features ready to start (dependencies satisfied, not in progress)',
    inputSchema: GetReadyInput,
  },
  async ({ limit = 10 }) => {
    const result = feature_get_ready(limit);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 15: feature_get_blocked
server.registerTool(
  'feature_get_blocked',
  {
    title: 'Get Blocked Features',
    description: 'Get features that are blocked by unmet dependencies',
    inputSchema: GetBlockedInput,
  },
  async ({ limit = 20 }) => {
    const result = feature_get_blocked(limit);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 16: feature_get_graph
server.registerTool(
  'feature_get_graph',
  {
    title: 'Get Dependency Graph',
    description: 'Get dependency graph data for visualization',
    inputSchema: {},
  },
  async () => {
    const result = feature_get_graph();
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

// Tool 17: feature_set_dependencies
server.registerTool(
  'feature_set_dependencies',
  {
    title: 'Set All Dependencies',
    description: 'Set all dependencies for a feature at once, replacing any existing dependencies',
    inputSchema: SetDependenciesInput,
  },
  async ({ feature_id, dependency_ids }) => {
    const result = feature_set_dependencies(feature_id, dependency_ids);
    return {
      content: [{ type: 'text', text: result }],
      structuredContent: JSON.parse(result),
    };
  }
);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let mode: 'stdio' | 'http' | 'https' = 'stdio';
  let port = 8080;
  let certPath: string | undefined;
  let keyPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--http') {
      mode = 'http';
    } else if (arg === '--https') {
      mode = 'https';
    } else if (arg === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--cert' && i + 1 < args.length) {
      certPath = args[i + 1];
      i++;
    } else if (arg === '--key' && i + 1 < args.length) {
      keyPath = args[i + 1];
      i++;
    }
  }

  return { mode, port, certPath, keyPath };
}

/**
 * Start the MCP server in stdio mode
 */
async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server running on stdio');
}

/**
 * Start the MCP server in HTTP mode
 */
async function startHttpServer(port: number) {
  const app = express();
  app.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing session
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
          console.error('Session initialized:', id);
        },
        onsessionclosed: (id) => {
          delete transports[id];
          console.error('Session closed:', id);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const transport = transports[sessionId];
    if (transport) {
      await transport.handleRequest(req, res);
    } else {
      res.status(400).send('Invalid session');
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const transport = transports[sessionId];
    if (transport) {
      await transport.handleRequest(req, res);
    } else {
      res.status(400).send('Invalid session');
    }
  });

  app.listen(port, () => {
    console.error(`MCP server running on http://localhost:${port}/mcp`);
  });
}

/**
 * Start the MCP server in HTTPS mode
 */
async function startHttpsServer(port: number, certPath?: string, keyPath?: string) {
  if (!certPath || !keyPath) {
    throw new Error('HTTPS mode requires --cert and --key arguments');
  }

  const app = express();
  app.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing session
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
          console.error('Session initialized:', id);
        },
        onsessionclosed: (id) => {
          delete transports[id];
          console.error('Session closed:', id);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const transport = transports[sessionId];
    if (transport) {
      await transport.handleRequest(req, res);
    } else {
      res.status(400).send('Invalid session');
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const transport = transports[sessionId];
    if (transport) {
      await transport.handleRequest(req, res);
    } else {
      res.status(400).send('Invalid session');
    }
  });

  const httpsServer = createServer(
    {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    },
    app
  );

  httpsServer.listen(port, () => {
    console.error(`MCP server running on https://localhost:${port}/mcp`);
  });
}

/**
 * Start the MCP server
 */
async function main() {
  const { mode, port, certPath, keyPath } = parseArgs();

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    closeDatabase();
    process.exit(0);
  });

  if (mode === 'http') {
    await startHttpServer(port);
  } else if (mode === 'https') {
    await startHttpsServer(port, certPath, keyPath);
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  closeDatabase();
  process.exit(1);
});
