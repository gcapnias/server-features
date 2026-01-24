/**
 * Input validation schemas for MCP tools
 *
 * These schemas mirror the Pydantic models from the Python implementation
 * and provide runtime validation for tool inputs using Zod.
 */

import { z } from 'zod';

/**
 * Input for marking a feature as passing
 */
export const MarkPassingInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to mark as passing'),
});

/**
 * Input for marking a feature as failing
 */
export const MarkFailingInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to mark as failing'),
});

/**
 * Input for skipping a feature
 */
export const SkipFeatureInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to skip'),
});

/**
 * Input for marking a feature as in-progress
 */
export const MarkInProgressInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to mark as in-progress'),
});

/**
 * Input for clearing in-progress status
 */
export const ClearInProgressInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to clear in-progress status'),
});

/**
 * Input for getting a feature by ID
 */
export const GetByIdInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to retrieve'),
});

/**
 * Input for claiming and getting a feature
 */
export const ClaimAndGetInput = z.object({
  feature_id: z.number().int().min(1).describe('The ID of the feature to claim'),
});

/**
 * Schema for creating a single feature
 */
export const FeatureCreateItem = z.object({
  category: z.string().min(1).max(100).describe('Feature category'),
  name: z.string().min(1).max(255).describe('Feature name'),
  description: z.string().min(1).describe('Detailed description'),
  steps: z.array(z.string()).min(1).describe('Implementation/test steps'),
  depends_on_indices: z
    .array(z.number().int().min(0))
    .optional()
    .describe('Array indices of features in batch that this feature depends on'),
});

/**
 * Input for bulk creating features
 */
export const BulkCreateInput = z.object({
  features: z.array(FeatureCreateItem).min(1).describe('List of features to create'),
});

/**
 * Input for creating a single feature
 */
export const CreateFeatureInput = z.object({
  category: z
    .string()
    .min(1)
    .max(100)
    .describe('Feature category (e.g., "Authentication", "API", "UI")'),
  name: z.string().min(1).max(255).describe('Feature name'),
  description: z.string().min(1).describe('Detailed description of the feature'),
  steps: z.array(z.string()).min(1).describe('List of implementation/verification steps'),
});

/**
 * Input for adding a dependency
 */
export const AddDependencyInput = z.object({
  feature_id: z.number().int().min(1).describe('Feature to add dependency to'),
  dependency_id: z.number().int().min(1).describe('ID of the dependency feature'),
});

/**
 * Input for removing a dependency
 */
export const RemoveDependencyInput = z.object({
  feature_id: z.number().int().min(1).describe('Feature to remove dependency from'),
  dependency_id: z.number().int().min(1).describe('ID of dependency to remove'),
});

/**
 * Input for setting all dependencies
 */
export const SetDependenciesInput = z.object({
  feature_id: z.number().int().min(1).describe('Feature to set dependencies for'),
  dependency_ids: z.array(z.number().int().min(1)).describe('List of dependency feature IDs'),
});

/**
 * Input for getting ready features
 */
export const GetReadyInput = z.object({
  limit: z.number().int().min(1).max(50).default(10).describe('Max features to return'),
});

/**
 * Input for getting blocked features
 */
export const GetBlockedInput = z.object({
  limit: z.number().int().min(1).max(100).default(20).describe('Max features to return'),
});

/**
 * Output schemas for tools (used for structured responses)
 */

export const FeatureOutput = z.object({
  id: z.number(),
  priority: z.number(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(z.string()),
  passes: z.boolean(),
  in_progress: z.boolean(),
  dependencies: z.array(z.number()).nullable(),
});

export const StatsOutput = z.object({
  passing: z.number(),
  in_progress: z.number(),
  total: z.number(),
  percentage: z.number(),
});

export const SuccessOutput = z.object({
  success: z.boolean(),
  feature_id: z.number().optional(),
  name: z.string().optional(),
  message: z.string().optional(),
});

export const ErrorOutput = z.object({
  error: z.string(),
});
