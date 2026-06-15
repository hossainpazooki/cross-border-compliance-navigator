module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // react-hooks/recommended is provided transitively by next/core-web-vitals;
    // declaring it here too triggers ESLint's "couldn't determine plugin
    // uniquely" error (duplicate eslint-plugin-react-hooks install paths).
    'next/core-web-vitals',
  ],
  ignorePatterns: ['dist', '.next', 'next-env.d.ts', '.eslintrc.cjs', 'packages', 'tools'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // App-Router project (app/, no pages/). next/core-web-vitals ships this
    // Pages-Router-only rule, which misfires on non-Next anchors (e.g. the
    // /legacy/ escape-hatch link served outside Next routing). Disable it.
    '@next/next/no-html-link-for-pages': 'off',
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
