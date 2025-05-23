module.exports = {
  root: true,
  env: { browser: true, es2020: true, 'vitest-globals/env': true },
  extends: [
    'eslint:recommended',
    'prettier',
    'mx',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:vitest-globals/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    //add this back in
    // 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@kyper/input',
            message: "Please import from 'src/privacy/input instead'.",
          },
          {
            name: '@kyper/select',
            message: "Please import from 'src/privacy/input instead'.",
          },
          {
            name: '@kyper/selectionbox',
            message: "Please import from 'src/privacy/input instead'.",
          },
          {
            name: '@kyper/textarea',
            message: "Please import from 'src/privacy/input instead'.",
          },
          {
            name: '@kyper/userfeedback',
            message: "Please import from 'src/privacy/input instead'.",
            importNames: ['UserFeedback'],
          },
          {
            name: '@mui/material/TextField',
            message: "Please import from 'src/privacy/input instead'.",
            importNames: ['TextField'],
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/**/*.js'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['./*', '../*'],
                message:
                  "The Connect team prefers to NOT use relative file imports.  Start imports from 'src/' instead",
              },
            ],
          },
        ],
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['*.md'],
      parser: 'markdown-eslint-parser',
    },
  ],
}
