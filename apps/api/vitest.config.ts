import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      LOCAL_STRICT: '1'
    },
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: './coverage'
    }
  }
});
