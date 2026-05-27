import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import ternityGuards from './tooling/eslint/index.js';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Portable production-readiness guards (see tooling/eslint). In-editor counterpart to
  // the source-scan guard tests — bans casting request.body instead of validating it.
  ...ternityGuards,
);
