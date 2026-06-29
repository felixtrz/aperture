import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@aperture-engine/math/kernel",
        replacement: new URL(
          "./packages/math/src/kernel/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/math",
        replacement: new URL("./packages/math/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/config",
        replacement: new URL("./packages/app/src/config.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/systems",
        replacement: new URL("./packages/app/src/systems.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/advanced",
        replacement: new URL("./packages/app/src/advanced.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/headless-tools",
        replacement: new URL(
          "./packages/app/src/headless-tools.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/app/headless",
        replacement: new URL("./packages/app/src/headless.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/input",
        replacement: new URL("./packages/app/src/input.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/entity-lookup",
        replacement: new URL(
          "./packages/app/src/entity-lookup.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/app/commands",
        replacement: new URL("./packages/app/src/commands.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/diagnostics",
        replacement: new URL(
          "./packages/app/src/diagnostics.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/app/asset-mirror",
        replacement: new URL(
          "./packages/app/src/asset-mirror.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/app/vite",
        replacement: new URL("./packages/app/src/vite.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/browser",
        replacement: new URL("./packages/app/src/browser.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app/worker",
        replacement: new URL("./packages/app/src/worker.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/app",
        replacement: new URL("./packages/app/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/cli",
        replacement: new URL("./packages/cli/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/physics/testing",
        replacement: new URL(
          "./packages/physics/src/testing.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/physics-rapier",
        replacement: new URL(
          "./packages/physics-rapier/src/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/physics",
        replacement: new URL("./packages/physics/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/render/test-support",
        replacement: new URL(
          "./packages/render/src/test-support.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/render",
        replacement: new URL("./packages/render/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/ui/test-support",
        replacement: new URL(
          "./packages/ui/src/test-support.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/ui",
        replacement: new URL("./packages/ui/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/runtime",
        replacement: new URL("./packages/runtime/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/simulation",
        replacement: new URL(
          "./packages/simulation/src/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/vite-plugin",
        replacement: new URL(
          "./packages/vite-plugin/src/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/webgpu/test-support",
        replacement: new URL(
          "./packages/webgpu/src/test-support.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/webgpu",
        replacement: new URL("./packages/webgpu/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/audio/test-support",
        replacement: new URL(
          "./packages/audio/src/test-support.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@aperture-engine/audio",
        replacement: new URL("./packages/audio/src/index.ts", import.meta.url)
          .pathname,
      },
    ],
  },
  test: {
    exclude: [
      "test/e2e/**",
      "node_modules/**",
      "dist/**",
      "packages/*/dist/**",
      // Gitignored local research checkouts (e.g. references/uikit) carry their
      // own vitest configs/tests and must not be swept into Aperture's suite.
      "references/**",
    ],
    // AI-77: coverage thresholds gate CI (the dedicated coverage job runs
    // `pnpm run test:coverage`). Thresholds sit just below measured reality
    // (2026-06-09: 85.45% statements / 73.91% branches / 90.74% functions /
    // 85.36% lines) so regressions fail while routine churn does not.
    // Ratchet them upward when coverage rises meaningfully; never lower them
    // to make a PR pass.
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      // render/driver.ts launches a real Playwright browser, so it can only run
      // out of process; it is verified by the committed e2e
      // (test/e2e/render-snapshot-cli.spec.ts, SwiftShader project), the same
      // way browser-only code lives behind test/e2e/**. Its pure helpers
      // (web-root resolution, the static server) stay covered by unit tests.
      exclude: ["packages/cli/src/render/driver.ts"],
      thresholds: {
        statements: 85,
        branches: 73.5,
        functions: 90,
        lines: 85,
      },
    },
  },
});
