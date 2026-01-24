import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exit after all tests complete instead of entering watch mode
    watch: false,
    // Run tests in parallel by default
    pool: 'forks',
    // Use in-memory databases for tests
    globals: true,
    // Only run tests from source, not from dist
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
