import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/mcp/**/*.test.ts"],
    environment: "node",
    maxWorkers: 1,
    testTimeout: 90000,
    hookTimeout: 15000,
  },
});
