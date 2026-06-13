import { defineConfig, devices } from "@playwright/test";

// Local macOS WebGPU e2e config: Playwright's bundled Chromium in new-headless
// mode drives WebGPU on Metal directly (verified: adapter vendor=apple,
// arch=metal-3). Unlike the system Google Chrome channel, the bundled binary
// does not hang on browser close after WebGPU pages, so multi-file runs work
// in a single invocation. WebGPU is only exposed in a secure context, so tests
// must navigate to the localhost example server — never about:blank.
const metalChromiumArgs = [
  "--enable-unsafe-webgpu",
  // Decouple frame production from the display/vsync source. On headless-
  // display machines (e.g. a Mac mini with no monitor) Chrome's BeginFrame
  // source intermittently stalls, freezing requestAnimationFrame mid-test --
  // pages stop publishing status and pixel readbacks blank. Without vsync the
  // compositor free-runs and WebGPU pages render deterministically.
  "--disable-frame-rate-limit",
  "--disable-gpu-vsync",
  // Anti-throttle: keep rendering when the harness backgrounds the command.
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
];

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results/playwright-macos",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 150000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 960, height: 640 },
  },
  webServer: {
    command: "pnpm run examples:build && pnpm run examples:serve",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
    timeout: 180000,
  },
  projects: [
    {
      name: "chromium-webgpu-metal",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        channel: "chromium",
        headless: true,
        launchOptions: {
          args: metalChromiumArgs,
        },
      },
    },
  ],
});
