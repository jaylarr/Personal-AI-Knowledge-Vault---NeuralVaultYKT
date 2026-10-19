import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/local-domain.test.ts", "tests/integration/local-domain*.test.ts"],
    environment: "node",
    maxWorkers: 2,
    testTimeout: 15000,
  },
});
