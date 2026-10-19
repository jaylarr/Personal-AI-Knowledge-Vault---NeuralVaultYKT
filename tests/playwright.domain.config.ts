import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./domain-browser",
  outputDir: "../.artifacts/domain-browser",
  workers: 1,
  use: {
    baseURL: "http://localhost:4323",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    command: "node --import tsx tests/fixtures/local-domain-server.ts",
    url: "http://localhost:4323/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
