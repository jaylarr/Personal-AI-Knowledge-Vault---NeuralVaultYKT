import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./owner-browser",
  outputDir: "../.artifacts/owner-browser",
  workers: 1,
  use: {
    baseURL: "http://localhost:4319",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "off",
  },
  webServer: {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    command: "node --env-file=.local/test.env --import tsx tests/fixtures/owner-server.ts",
    env: { NODE_ENV: "test" },
    url: "http://localhost:4319/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
