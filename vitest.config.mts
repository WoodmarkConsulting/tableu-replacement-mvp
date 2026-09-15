import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
