import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  workspaceFolder: '../../tests',
  installExtensions: ['vadimcn.vscode-lldb@1.12.3'],
  launchArgs: ['--disable-workspace-trust'],
  mocha: { ui: 'bdd', timeout: 60000 },
});
