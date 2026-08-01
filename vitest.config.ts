import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: ['src/main.ts', 'src/vite-env.d.ts'],
    },
  },
});
