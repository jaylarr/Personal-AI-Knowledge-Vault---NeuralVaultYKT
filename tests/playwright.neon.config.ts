import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./live",
  outputDir: "../.artifacts/neon-live",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:4317",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    // Auth test traffic contains tokens/passwords. Never retain traces or network recordings.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
