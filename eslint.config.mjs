import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// One flat config for the whole workspace. ESLint searches upward from each
// package's directory, so every package's `eslint src/` finds this file.
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/.tanstack/**', '**/node_modules/**', '**/routeTree.gen.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/dashboard/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // Only the two classic hook rules. The React Compiler rules that
      // eslint-plugin-react-hooks 7 adds to `recommended` assume the compiler
      // is in use, which it is not.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: ['Route'] }],
    },
  },
  {
    // TanStack Router route files export `Route` alongside the page's local
    // components by design; the router plugin, not Fast Refresh boundaries,
    // decides how they are split.
    files: ['apps/dashboard/src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
