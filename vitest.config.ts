import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/db-*.test.ts', 'node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

