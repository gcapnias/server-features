/**
 * Shared constants from Python dependency_resolver.py
 */

// From Python dependency_resolver.py
export const MAX_DEPENDENCY_DEPTH = 50;
export const MAX_DEPENDENCIES = 20;
export const MAX_FEATURES = 10000;

// TypeScript-specific retry configuration
export const RETRY_DELAYS = [100, 200, 400, 800, 1600] as const;
