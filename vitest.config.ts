import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.ts','packages/**/*.test.tsx','apps/web/src/**/*.test.ts','apps/web/src/**/*.test.tsx'],
    coverage: {
      provider: 'v8', reporter: ['text','lcov','json-summary'],
      // main.tsx is the sole React bootstrap. All browser feature logic lives in app.tsx.
      include: ['packages/{core,platform,ui}/src/**/*.{ts,tsx}','apps/web/src/app.tsx'],
      exclude: ['**/*.test.ts','**/*.test.tsx'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
