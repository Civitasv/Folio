import { defineConfig } from 'vitest/config';
export default defineConfig({
 test: { environment: 'jsdom', include: ['packages/**/*.test.ts','packages/**/*.test.tsx'],
 coverage: { provider: 'v8', reporter: ['text','lcov','json-summary'], include: ['packages/{core,platform,ui}/src/**/*.{ts,tsx}'], exclude: ['**/*.test.ts','**/*.test.tsx'], thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } } }
});
