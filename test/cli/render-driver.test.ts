import { describe, expect, it } from "vitest";
import {
  normalizeRenderBundleWebGpuMetadata,
  readRenderBundleDigestMetadata,
  renderHarnessHtml,
} from "../../packages/cli/src/render/driver.js";

describe("renderHarnessHtml", () => {
  it("uses the requested canvas dimensions", () => {
    const html = renderHarnessHtml(
      {
        "@aperture-engine/render": "/_engine/render/dist/index.js",
      },
      { width: 320, height: 240 },
    );

    expect(html).toContain('width="320"');
    expect(html).toContain('height="240"');
    expect(html).not.toContain('width="960"');
    expect(html).not.toContain('height="640"');
  });
});

describe("render metadata helpers", () => {
  it("extracts JSON-safe bundle digest metadata", () => {
    expect(
      readRenderBundleDigestMetadata({
        digest: {
          algorithm: "fnv1a32-stable-json-v1",
          hash: "b65b87c8",
          byteLength: 7337,
        },
      }),
    ).toEqual({
      algorithm: "fnv1a32-stable-json-v1",
      hash: "b65b87c8",
      byteLength: 7337,
    });

    expect(
      readRenderBundleDigestMetadata({
        digest: { algorithm: "x", hash: "y", byteLength: -1 },
      }),
    ).toBeNull();
  });

  it("normalizes harness WebGPU metadata without leaking objects", () => {
    expect(
      normalizeRenderBundleWebGpuMetadata({
        format: "bgra8unorm",
        displayColorSpace: "srgb",
        adapterInfo: {
          vendor: "swiftshader",
          architecture: "vulkan",
          nested: { ignored: true },
        },
        adapterFeatures: ["timestamp-query", 7, "texture-compression-bc"],
        deviceFeatures: ["timestamp-query"],
      }),
    ).toEqual({
      format: "bgra8unorm",
      displayColorSpace: "srgb",
      adapterInfo: {
        vendor: "swiftshader",
        architecture: "vulkan",
      },
      adapterFeatures: ["texture-compression-bc", "timestamp-query"],
      deviceFeatures: ["timestamp-query"],
    });
  });
});
