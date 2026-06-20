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

    expect(plugin.config?.()).toBeUndefined();
  });
});
