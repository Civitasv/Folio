import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.ts','packages/**/*.test.tsx','apps/web/src/**/*.test.ts','apps/web/src/**/*.test.tsx'],
    coverage: {
      provider: 'v8', reporter: ['text','lcov','json-summary'],
      // main.tsx only mounts React; all feature logic, including DOI UI, is covered.
      include: ['packages/{core,platform,ui}/src/**/*.{ts,tsx}','apps/web/src/app.tsx','apps/web/src/epub-reader.tsx','apps/web/src/doi-panel.tsx','apps/web/src/translation-panel.tsx','apps/web/src/api-settings.tsx'],
      exclude: ['**/*.test.ts','**/*.test.tsx'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
