import { defineConfig, devices } from "@playwright/test";

const showBrowserWindow = process.env.APERTURE_E2E_SHOW_BROWSER === "1";
const browserChannel = showBrowserWindow ? "chrome" : "chromium";
const browserHeadless = !showBrowserWindow;
const browserProjectName = showBrowserWindow
  ? "chrome-webgpu-headed"
  : "chromium-webgpu-metal";
const browserLaunchArgs = showBrowserWindow
  ? ["--enable-unsafe-webgpu"]
  : [
      "--enable-unsafe-webgpu",
      "--disable-frame-rate-limit",
      "--disable-gpu-vsync",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ];

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  retries: process.env.CI === "true" ? 1 : 0,
  workers: 1,
  timeout: 150000,
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
    command: "pnpm run examples:build && pnpm run examples:serve",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120000,
  },
  projects: [
    {
      name: browserProjectName,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        channel: browserChannel,
        headless: browserHeadless,
        launchOptions: {
          args: browserLaunchArgs,
        },
      },
    },
  ],
});
