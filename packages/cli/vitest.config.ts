import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Vite plugin that resolves `.js` imports to their `.ts` counterparts.
 * Required when TypeScript is configured with `moduleResolution: NodeNext`
 * (which mandates `.js` extensions in imports) and tests are run via Vite/Vitest.
 */
const resolveJsToTs: Plugin = {
  name: 'resolve-js-to-ts',
  enforce: 'pre' as const,
  resolveId(id: string, importer: string | undefined) {
    if (importer && id.endsWith('.js') && !id.includes('node_modules')) {
      const tsPath = resolve(dirname(importer), id.replace(/\.js$/, '.ts'));
      if (existsSync(tsPath)) {
        return tsPath;
      }
    }
    return undefined;
  },
};

export default defineConfig({
  plugins: [resolveJsToTs],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
    },
  },
});
