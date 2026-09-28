import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const FEATURE_DIRS = '{auth,refunds,kyc,feature-flags,audit}';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/coverage/**',
      '**/.vite/**',
      'tests/e2e/.playwright/**',
      'tests/e2e/playwright-report/**',
      'tests/e2e/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Route handlers stay async for a uniform signature even when a branch has no await.
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Feature modules are flat directories; a sibling feature may only be imported via its index.
    files: ['apps/*/src/modules/*/**', 'apps/*/src/features/*/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [`../${FEATURE_DIRS}/!(index|index.js)`, `../${FEATURE_DIRS}/*/**`],
              message: 'Import another feature only through its index.ts public surface.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'tests/e2e/**/*.ts', 'packages/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
