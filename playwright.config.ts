import { defineConfig } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome"
  },
  webServer: {
    command: "npm run build && npm start",
    url: `${BASE_URL}/healthz`,
    env: {
      NODE_ENV: "production",
      APP_BASE_URL: BASE_URL
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
