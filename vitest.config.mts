import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'contract', include: ['packages/contract/test/**/*.test.ts'] } },
      { test: { name: 'webview', include: ['packages/webview/test/**/*.test.ts'] } },
      {
        test: {
          name: 'extension',
          include: ['packages/extension/test/unit/**/*.test.ts'],
          benchmark: { include: ['packages/extension/test/bench/**/*.bench.ts'] },
        },
      },
      { test: { name: 'harness', include: ['tests/*.test.mjs'] } },
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/contract/src/**/*.ts',
        'packages/webview/src/**/*.{ts,tsx}',
        'packages/extension/src/**/*.ts',
        'tests/normalize.mjs',
      ],
      exclude: ['packages/contract/src/graphSnapshot.ts'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
