import { describe, expect, it } from "vitest";

import {
  APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS,
  aperture,
} from "../../packages/vite-plugin/src/index.js";

describe("Aperture Vite plugin cross-origin isolation", () => {
  it("emits COOP/COEP headers for the dev server and preview by default", () => {
    const plugin = aperture();
    const config = plugin.config?.();

    expect(config?.server?.headers).toEqual(
      APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS,
    );
    expect(config?.preview?.headers).toEqual(
      APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS,
    );
    // The transport requires a cross-origin-isolated document for
    // SharedArrayBuffer; assert the exact header contract.
    expect(config?.server?.headers).toMatchObject({
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
  });

  it("omits the headers when cross-origin isolation is opted out", () => {
    const plugin = aperture({ crossOriginIsolation: false });
    const config = plugin.config?.();

    // Headers are gated on cross-origin isolation...
    expect(config?.server).toBeUndefined();
    expect(config?.preview).toBeUndefined();
    // ...but the worker format + dep pre-bundling are always configured
    // (see GH #24 / GH #31).
    expect(config?.worker).toEqual({ format: "es" });
    expect(config?.optimizeDeps?.include).toEqual(
      expect.arrayContaining(["@aperture-engine/app/systems"]),
    );
  });

  it("pins the worker format to es and pre-bundles the Aperture entries", () => {
    const config = aperture().config?.();

    expect(config?.worker).toEqual({ format: "es" });
    expect(config?.optimizeDeps?.include).toEqual(
      expect.arrayContaining([
        "@aperture-engine/app/config",
        "@aperture-engine/app/systems",
        "@aperture-engine/app/browser",
      ]),
    );
  });
});
