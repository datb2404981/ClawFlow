// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'eslint.config.mjs',
    'dist/**',
    'coverage/**',
    'node_modules/**',
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Prettier luôn chọn 1 kiểu (mảng/import xuống dòng hay không phụ thuộc printWidth) — không có chế độ “tùy ý”.
      // Tắt prettier trong ESLint để không bị giới hạn / lỗi lint vì cách xuống dòng; vẫn format được bằng `npm run format` hoặc Prettier trong editor.
      'prettier/prettier': 'off',
    },
  },
);
