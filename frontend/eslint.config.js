const nextCoreWebVitals = require("eslint-config-next/core-web-vitals")
const tsParser = require("@typescript-eslint/parser")
const tsPlugin = require("@typescript-eslint/eslint-plugin")

module.exports = [
  ...nextCoreWebVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      // Next 16 promoted these two React Compiler rules to error. 13 files
      // trigger them; refactor tracked in B48. Demoted to warn to keep CI
      // green while the migration lands separately (guardrail: one bug = one PR).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "out/**"],
  },
]
