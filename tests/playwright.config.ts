import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./e2e",
  outputDir: "../.artifacts/playwright",
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:4318",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    command: "node apps/api/dist/index.js",
    env: { API_PORT: "4318", ATLAS_STORAGE_MODE: "cloud" },
    url: "http://localhost:4318/health",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
