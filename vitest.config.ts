import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@aperture-engine/core": new URL(
        "./packages/core/src/index.ts",
        import.meta.url,
      ).pathname,
      "@aperture-engine/render": new URL(
        "./packages/render/src/index.ts",
        import.meta.url,
      ).pathname,
      "@aperture-engine/runtime": new URL(
        "./packages/runtime/src/index.ts",
        import.meta.url,
      ).pathname,
      "@aperture-engine/simulation": new URL(
        "./packages/simulation/src/index.ts",
        import.meta.url,
      ).pathname,
      "@aperture-engine/webgpu": new URL(
        "./packages/webgpu/src/index.ts",
        import.meta.url,
      ).pathname,
    },
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
