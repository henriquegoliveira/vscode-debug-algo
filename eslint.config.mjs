import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Ignorar pastas e arquivos gerados
  {
    ignores: [
      '**/.yarn/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/.cache/**',
      '**/esbuild.js',
      '**/webpack.config.ts',
      // Gerado por `yarn workspace dbga-extension gen:types` a partir do schema
      'packages/extension/src/graphSnapshot.ts',
    ],
  },

  // Configuração base para arquivos JS e TS
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },

  // Regras de React aplicadas especificamente à pasta packages/webview/src
  {
    files: ['packages/webview/src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Desativado se usar React 17+
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Prettier (deve ser sempre o último para sobrescrever regras conflitantes)
  eslintConfigPrettier,
];
