import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./local-browser",
  outputDir: "../.artifacts/local-browser",
  workers: 1,
  use: {
    baseURL: "http://localhost:4320",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "off",
  },
  webServer: {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    command: "node --import tsx tests/fixtures/local-vault-server.ts",
    url: "http://localhost:4320/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
