import eslintConfigPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const tsFiles = ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', '*.config.ts'];

const simulationBoundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['phaser', 'react', 'react-dom', 'react-dom/*', '@base-ui/*', '@base-ui/react/*'],
          message: 'Simulation code must stay independent of browser, React, and renderer packages.',
        },
        {
          group: ['../game/**', '../ui/**', '../components/**', '../../game/**', '../../ui/**', '../../components/**'],
          message: 'Simulation code may depend on content, but not on client or UI layers.',
        },
      ],
    },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'Date', message: 'Simulation behavior must not depend on wall-clock time.' },
    { name: 'window', message: 'Simulation code must not read browser globals.' },
    { name: 'document', message: 'Simulation code must not read browser globals.' },
    { name: 'navigator', message: 'Simulation code must not read browser globals.' },
    { name: 'localStorage', message: 'Simulation code must not read browser globals.' },
    { name: 'sessionStorage', message: 'Simulation code must not read browser globals.' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Inject the seeded RNG in simulation code.' },
    { object: 'Date', property: 'now', message: 'Simulation behavior must not depend on wall-clock time.' },
    { object: 'performance', property: 'now', message: 'Simulation behavior must not depend on frame timing.' },
  ],
};

const noFeatureVendorImports = {
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: '@base-ui/react',
          message: 'Feature UI should consume Torch-owned primitives instead of Base UI directly.',
        },
      ],
      patterns: [
        {
          group: ['@base-ui/react/*'],
          message: 'Feature UI should consume Torch-owned primitives instead of Base UI directly.',
        },
      ],
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/assets/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: config.files ?? tsFiles,
  })),
  jsxA11y.flatConfigs.recommended,
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-unreachable': 'error',
      'no-console': 'error',
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme'], location: 'anywhere' }],
    },
  },
  {
    files: ['src/dev/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['src/sim/**/*.{ts,tsx}'],
    rules: simulationBoundaryRules,
  },
  {
    files: ['src/content/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'react', 'react-dom', 'react-dom/*', '@base-ui/*', '@base-ui/react/*'],
              message: 'Content definitions must remain independent of UI and renderer packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: noFeatureVendorImports,
  },
  {
    files: ['src/ui/primitives.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
    rules: {
      'no-console': 'off',
      'no-warning-comments': 'off',
    },
  },
  eslintConfigPrettier,
);
