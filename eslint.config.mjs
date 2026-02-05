import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'scripts/*.ts',
            'vitest.config.ts',
            'vite.config.ts',
            'vite.webview.config.ts',
            'playwright.config.ts',
            'e2e/*.ts',
            'e2e/fixtures/*.ts',
            'src/webview/entries/*.ts',
            'src/webview/lib/*.ts',
            'src/webview/stores/*.ts',
          ],
          // Increase limit from 8 to 20 for config files and webview code
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow unused vars starting with underscore
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow explicit any in some cases (we'll tighten this later)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'out/',
      '*.js',
      '*.cjs',
      'src/test/e2e/',
      'src/webview/**/*.svelte',
    ],
  }
);
