import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    // Nested agent worktrees ship their own build output. The bare globs above
    // are root-relative, so they must be repeated for any nested checkout.
    "**/.next/**",
    "**/.next-*/**",
    ".agent-worktrees/**",
    "**/.agent-worktrees/**",
    "out/**",
    "build/**",
    ".vercel/**",
    "**/.vercel/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
