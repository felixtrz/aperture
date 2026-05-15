import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createMeshGpuUploadPlan,
  createPlaneMeshAsset,
  type MeshAsset,
} from "../../src/index.js";

describe("mesh GPU upload planning descriptors", () => {
  it("plans box mesh vertex and index uploads with stable labels", () => {
    const box = createBoxMeshAsset({ label: "Cube" });
    const result = createMeshGpuUploadPlan(box);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      label: "Cube",
      vertexStreams: [
        {
          label: "Cube/vertex:primitive-interleaved",
          streamId: "primitive-interleaved",
          usage: "vertex",
          arrayStride: 32,
          vertexCount: 24,
          byteLength: 24 * 32,
        },
      ],
      indexBuffer: {
        label: "Cube/index",
        usage: "index",
        format: "uint16",
        indexCount: 36,
        byteLength: 36 * 2,
      },
      submeshes: [
        {
          label: "default",
          topology: "triangle-list",
          vertexStart: 0,
          vertexCount: 24,
          indexStart: 0,
          indexCount: 36,
        },
      ],
    });
    expect(result.plan?.vertexStreams[0]?.source).toBe(
      box.vertexStreams[0]?.data,
    );
    expect(result.plan?.indexBuffer?.source).toBe(box.indexBuffer?.data);
  });

  it("plans plane mesh ranges without mutating source data", () => {
    const plane = createPlaneMeshAsset({
      label: "Ground",
      width: 2,
      height: 4,
    });
    const result = createMeshGpuUploadPlan(plane);

    expect(result.valid).toBe(true);
    expect(result.plan?.vertexStreams[0]).toMatchObject({
      label: "Ground/vertex:primitive-interleaved",
      vertexCount: 4,
      byteLength: 4 * 32,
    });
    expect(result.plan?.submeshes[0]).toEqual({
      label: "default",
      topology: "triangle-list",
      materialSlot: 0,
      vertexStart: 0,
      vertexCount: 4,
      indexStart: 0,
      indexCount: 6,
    });
  });

  it("reports missing vertex stream source data", () => {
    const plane = createPlaneMeshAsset();
    const invalid: MeshAsset = {
      ...plane,
      vertexStreams: [
        {
          ...required(plane.vertexStreams[0]),
          data: undefined as unknown as Float32Array,
        },
      ],
    };

    expect(createMeshGpuUploadPlan(invalid)).toMatchObject({
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "meshUpload.missingVertexStreamData",
          streamId: "primitive-interleaved",
        },
      ],
    });
  });

  it("reports invalid vertex and index source data", () => {
    const plane = createPlaneMeshAsset();
    const invalid: MeshAsset = {
      ...plane,
      vertexStreams: [
        {
          ...required(plane.vertexStreams[0]),
          data: new Float32Array([0, 1, 2]),
        },
      ],
      indexBuffer: {
        format: "uint32",
        data: required(plane.indexBuffer).data as unknown as Uint32Array,
      },
    };

    expect(
      createMeshGpuUploadPlan(invalid).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "meshUpload.invalidVertexStreamData",
      "meshUpload.invalidIndexData",
    ]);
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
