import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", timeout: 30_000, retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 120_000 },
});
