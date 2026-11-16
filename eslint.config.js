import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'core/src/generated/**', 'mcp/demo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['Date', 'window', 'document', 'fetch', 'localStorage'].map((name) => ({
          name,
          message: `core/src must not use ${name}.`,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'core/src must not use Math.random.' },
      ],
    },
  },
);