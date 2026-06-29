import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '**/dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // データ取得effect内のsetStateは本アプリの一般的かつ正当なパターンのため警告に緩和
      'react-hooks/set-state-in-effect': 'warn',
      // hook+component同居（AuthContext等）やヘルパー併存（AuthPage等）は意図的。Fast Refresh用の助言として警告に
      'react-refresh/only-export-components': 'warn',
    },
  },
])
