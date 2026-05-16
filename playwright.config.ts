import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  retries: process.env.CI === "true" ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 960, height: 640 },
  },
  webServer: {
    command: "npm run examples:build && npm run examples:serve",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium-webgpu",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        launchOptions: {
          args: ["--enable-unsafe-webgpu"],
        },
      },
    },
  ],
});
