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
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 960, height: 640 },
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
