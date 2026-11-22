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
    // Agente de leads: Google Apps Script (script clásico, funciones globales).
    files: ['automation/apps-script/LeadAgent.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        SpreadsheetApp: 'readonly',
        PropertiesService: 'readonly',
        Session: 'readonly',
        LockService: 'readonly',
        MailApp: 'readonly',
        Utilities: 'readonly',
        ScriptApp: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { vars: 'local' }],
    },
  },
  {
    // Scripts de los agentes y pruebas (Node).
    files: ['automation/**/*.mjs', 'tests/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
])
