import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "warn",
      "no-console": "off",
    },
  },
  {
    ignores: [
      "__tests__/**",
      "node_modules/**",
      "dist/**",
      "desktop-dist/**",
      "src-tauri/target/**",
      ".next/**",
      "out/**",
      ".desktop-artifacts/**",
      ".pixi/**",
      "public/wasm/**",
      "jest.config.js",
      "jest.setup.js",
      "tailwind.config.ts",
      "postcss.config.mjs",
    ],
  }
);
