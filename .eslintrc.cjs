module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.next', 'next-env.d.ts', '.eslintrc.cjs', 'packages', 'tools'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Under Next (webpack/turbopack) `import.meta.env` is a runtime TypeError,
    // not undefined. All env reads must go through src/shared/config/env.ts
    // (process.env.NEXT_PUBLIC_*). Ban `import.meta` so it cannot regress.
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MetaProperty[meta.name="import"]',
        message:
          'import.meta is banned under Next — read env via src/shared/config/env.ts (process.env.NEXT_PUBLIC_*).',
      },
    ],
  },
};
