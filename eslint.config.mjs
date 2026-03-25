import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
  {
    ignores: [
      "__tests__/**",
      "node_modules/**",
      ".next/**",
      "out/**",
      "jest.config.js",
      "jest.setup.js",
      "tailwind.config.ts",
      "postcss.config.mjs",
    ],
  }
);
