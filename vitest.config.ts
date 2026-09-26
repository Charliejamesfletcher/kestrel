import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Use workspace packages' TypeScript source directly in tests (no build needed)
    conditions: ['development']
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node'
  }
});
