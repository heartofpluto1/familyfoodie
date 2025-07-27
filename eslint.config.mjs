import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier")
  .plugins("prettier")
  .rules({
    "prettier/prettier": ["error", {
      endOfLine: "auto" // This helps with line endings across different OS
    }],
  }),
];

export default eslintConfig;
