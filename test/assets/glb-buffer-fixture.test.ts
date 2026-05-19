import { describe, expect, it } from "vitest";

import { createNoFetchGlbSourceLoaderReport } from "@aperture-engine/render";

import { createIndexedTriangleGlbFixture } from "./glb-buffer-fixture.js";

describe("buffer-backed GLB source fixtures", () => {
  it("feeds a minimal indexed triangle through the no-fetch source facade", () => {
    const fixture = createIndexedTriangleGlbFixture();
    const report = createNoFetchGlbSourceLoaderReport({
      source: fixture.source,
      createMeshAssets: true,
    });
    const serialized = JSON.stringify({
      status: report.status,
      outputSummary: report.outputSummary,
    });

    expect(report.glbImportReport.valid).toBe(true);
    expect(report.status).toMatchObject({
      status: "loaded",
      sourceKind: "glb",
      byteLength: fixture.source.byteLength,
      externalBuffers: [],
      diagnostics: [],
      glbSourceStatus: {
        valid: true,
        chunks: [
          { type: "json", byteLength: expect.any(Number) },
          { type: "bin", byteLength: fixture.bytes.byteLength },
        ],
      },
    });
    expect(report.outputSummary).toEqual({
      meshConstruction: {
        status: "ready",
        valid: true,
        meshCount: 1,
        submeshCount: 1,
        vertexCount: 3,
        indexCount: 3,
        diagnosticsCount: 0,
      },
      sourceRegistration: {
        status: "absent",
        valid: null,
        writtenCount: 0,
        skippedCount: 0,
        diagnosticsCount: 0,
        stages: [],
      },
    });
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain("Float32Array");
    expect(serialized).not.toContain("Uint16Array");
    expect(serialized).not.toContain("[0,1,2]");
  });
});
