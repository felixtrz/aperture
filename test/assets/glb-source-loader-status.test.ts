import { describe, expect, it } from "vitest";

import { createGlbSourceLoaderStatusJsonValue } from "@aperture-engine/render";

describe("GLB source-loader status", () => {
  it("projects pending status without source bytes", () => {
    const status = createGlbSourceLoaderStatusJsonValue({
      status: "pending",
      sourceKind: "glb",
    });

    expect(status).toEqual({
      status: "pending",
      sourceKind: "glb",
      byteLength: null,
      externalBuffers: [],
      diagnostics: [],
      glbSourceStatus: null,
    });
  });

  it("projects loaded status with byte lengths and compact GLB status", () => {
    const status = createGlbSourceLoaderStatusJsonValue({
      status: "loaded",
      sourceKind: "glb",
      byteLength: 128,
      externalBuffers: [
        {
          uri: "indices.bin",
          status: "loaded",
          byteLength: 6,
        },
      ],
      glbSourceStatus: {
        valid: true,
        byteLength: 128,
        chunks: [{ type: "json", byteLength: 64 }],
        diagnostics: [],
        importStages: [{ stage: "root", status: "provided" }],
      },
    });
    const serialized = JSON.stringify(status);

    expect(status).toMatchObject({
      status: "loaded",
      sourceKind: "glb",
      byteLength: 128,
      externalBuffers: [
        {
          uri: "indices.bin",
          status: "loaded",
          byteLength: 6,
        },
      ],
      glbSourceStatus: {
        valid: true,
        chunks: [{ type: "json", byteLength: 64 }],
      },
    });
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain("ArrayBuffer");
  });

  it("projects failed status with diagnostics only", () => {
    const status = createGlbSourceLoaderStatusJsonValue({
      status: "failed",
      sourceKind: "unknown",
      diagnostics: [
        {
          code: "glbSourceLoader.fetchFailed",
          severity: "error",
          uri: "scene.glb",
          message: "Primary GLB source could not be fetched.",
        },
      ],
    });

    expect(status).toMatchObject({
      status: "failed",
      sourceKind: "unknown",
      byteLength: null,
      diagnostics: [
        {
          code: "glbSourceLoader.fetchFailed",
          severity: "error",
          uri: "scene.glb",
        },
      ],
      glbSourceStatus: null,
    });
  });

  it("projects blocked external-buffer status without raw bytes", () => {
    const status = createGlbSourceLoaderStatusJsonValue({
      status: "blocked",
      sourceKind: "glb",
      byteLength: 128,
      externalBuffers: [
        {
          uri: "indices.bin",
          status: "blocked",
          byteLength: null,
          diagnosticCode: "glbSourceLoader.externalBufferMissing",
        },
      ],
      diagnostics: [
        {
          code: "glbSourceLoader.externalBufferMissing",
          severity: "error",
          uri: "indices.bin",
          message: "External buffer bytes were not provided.",
        },
      ],
    });
    const serialized = JSON.stringify(status);

    expect(status).toMatchObject({
      status: "blocked",
      externalBuffers: [
        {
          uri: "indices.bin",
          status: "blocked",
          byteLength: null,
          diagnosticCode: "glbSourceLoader.externalBufferMissing",
        },
      ],
      diagnostics: [
        {
          code: "glbSourceLoader.externalBufferMissing",
          severity: "error",
        },
      ],
    });
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain("ArrayBuffer");
    expect(serialized).not.toContain("[0,1,2]");
  });
});
