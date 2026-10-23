import tseslint from "typescript-eslint";

// Project rules from the spec: time only via Clock (TD-2), no string-built SQL (BR-1).
const noRawSql = [
  { selector: "CallExpression[callee.property.name='$queryRawUnsafe']", message: "Use the $queryRaw tagged template (BR-1)." },
  { selector: "CallExpression[callee.property.name='$executeRawUnsafe']", message: "Use the $executeRaw tagged template (BR-1)." },
];
const noWallClock = [
  { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: "Read time from the injected Clock, not Date.now() (TD-2)." },
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "Read time from the injected Clock, not new Date() (TD-2)." },
];

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/generated/**", "**/*.d.ts"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...noRawSql, ...noWallClock],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // The Clock itself, seed scripts, tests and the Node/Next config may touch the wall clock.
  {
    files: ["packages/core/src/clock.ts", "packages/seed/**", "**/test/**", "**/*.test.ts", "**/prisma.config.ts"],
    rules: { "no-restricted-syntax": ["error", ...noRawSql] },
  },
);
