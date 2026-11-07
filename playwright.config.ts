import { defineConfig, devices } from "@playwright/test";
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? {
      launchOptions: {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      },
    }
  : {};
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], browserName: "chromium", ...chrome },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    {
      name: "desktop-chromium",
      use: {
        viewport: { width: 1280, height: 900 },
        browserName: "chromium",
        ...chrome,
      },
    },
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
