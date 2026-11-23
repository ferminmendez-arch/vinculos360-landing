import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Receptor de leads: Google Apps Script (script clásico, funciones globales).
    files: ['automation/apps-script/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ContentService: 'readonly',
        PropertiesService: 'readonly',
        SpreadsheetApp: 'readonly',
        LockService: 'readonly',
        Utilities: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { vars: 'local', caughtErrors: 'none' }],
    },
  },
])
