import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
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
        find: "@aperture-engine/app/headless",
        replacement: new URL("./packages/app/src/headless.ts", import.meta.url)
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
        find: "@aperture-engine/core",
        replacement: new URL("./packages/core/src/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@aperture-engine/render",
        replacement: new URL("./packages/render/src/index.ts", import.meta.url)
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
        find: "@aperture-engine/webgpu",
        replacement: new URL("./packages/webgpu/src/index.ts", import.meta.url)
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
      "references/**",
    ],
  },
});
