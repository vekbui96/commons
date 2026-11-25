// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import commons from "./eslint/app-boundaries.js";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules", ".claude/worktrees"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      commons,
    },
    rules: {
      // The wall between apps: see eslint/app-boundaries.js and CLAUDE.md.
      "commons/app-boundaries": "error",
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  },
  {
    files: ["*.config.{ts,js}", "scripts/**/*.{js,mjs}", "eslint/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
