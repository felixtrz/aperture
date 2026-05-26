import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createPlaneMeshAsset,
  mergeMeshAssetsForBatch,
  type MeshAsset,
} from "@aperture-engine/render";
import { createMeshHandle } from "@aperture-engine/simulation";

describe("mesh merge batching primitive", () => {
  it("merges four distinct mesh handles sharing a vertex layout", () => {
    const box = createBoxMeshAsset({ label: "BatchBox" });
    const plane = createPlaneMeshAsset({ label: "BatchPlane" });
    const cylinder = createCylinderMeshAsset({
      label: "BatchCylinder",
      radialSegments: 8,
    });
    const cone = createConeMeshAsset({ label: "BatchCone", radialSegments: 8 });
    const sources = [
      { handle: createMeshHandle("batch-box"), mesh: box },
      { handle: createMeshHandle("batch-plane"), mesh: plane },
      { handle: createMeshHandle("batch-cylinder"), mesh: cylinder },
      { handle: createMeshHandle("batch-cone"), mesh: cone },
    ];
    const result = mergeMeshAssetsForBatch({
      label: "MergedBatch",
      sources,
    });
    const expectedVertexCount = sources.reduce(
      (sum, source) => sum + required(source.mesh.vertexStreams[0]).vertexCount,
      0,
    );
    const expectedIndexCount = sources.reduce(
      (sum, source) => sum + required(source.mesh.indexBuffer).data.length,
      0,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.mesh).toMatchObject({
      kind: "mesh",
      label: "MergedBatch",
      vertexStreams: [
        {
          id: "primitive-interleaved",
          arrayStride: 32,
          vertexCount: expectedVertexCount,
        },
      ],
      indexBuffer: {
        format: "uint16",
      },
    });
    expect(result.mesh?.submeshes.slice(0, 2)).toMatchObject([
      {
        label: "BatchBox/default",
        vertexStart: 0,
        vertexCount: 24,
        indexStart: 0,
        indexCount: 36,
      },
      {
        label: "BatchPlane/default",
        vertexStart: 24,
        vertexCount: 4,
        indexStart: 36,
        indexCount: 6,
      },
    ]);
    expect(result.mesh?.vertexStreams[0]?.data).toBeInstanceOf(Float32Array);
    expect(result.mesh?.vertexStreams[0]?.data.length).toBe(
      expectedVertexCount * 8,
    );
    expect(result.mesh?.indexBuffer?.data.length).toBe(expectedIndexCount);
    expect(result.ranges.map((range) => range.sourceMeshKey)).toEqual([
      "mesh:batch-box",
      "mesh:batch-plane",
      "mesh:batch-cylinder",
      "mesh:batch-cone",
    ]);
    expect(result.ranges.map((range) => range.mergedSubmesh)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(result.mesh?.indexBuffer?.data[36]).toBe(24);
    expect(result.mesh?.indexBuffer?.data[37]).toBe(25);
  });

  it("promotes merged indices to uint32 when the combined vertex count exceeds uint16", () => {
    const largeA = createLargeIndexedMesh("LargeA", 40_000);
    const largeB = createLargeIndexedMesh("LargeB", 40_000);
    const result = mergeMeshAssetsForBatch({
      sources: [
        { handle: createMeshHandle("large-a"), mesh: largeA },
        { handle: createMeshHandle("large-b"), mesh: largeB },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.mesh?.indexBuffer?.format).toBe("uint32");
    expect(result.mesh?.indexBuffer?.data).toBeInstanceOf(Uint32Array);
    expect(result.mesh?.indexBuffer?.data[3]).toBe(40_000);
  });

  it("reports incompatible layouts without producing a merged mesh", () => {
    const first = createPlaneMeshAsset({ label: "First" });
    const second = createPlaneMeshAsset({ label: "Second" });
    const incompatible: MeshAsset = {
      ...second,
      vertexStreams: [
        {
          ...required(second.vertexStreams[0]),
          id: "different-stream",
        },
      ],
    };
    const result = mergeMeshAssetsForBatch({
      sources: [
        { handle: createMeshHandle("first"), mesh: first },
        { handle: createMeshHandle("second"), mesh: incompatible },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.mesh).toBeNull();
    expect(result.diagnostics).toMatchObject([
      {
        code: "meshMerge.incompatibleVertexStreamLayout",
        severity: "error",
        meshKey: "mesh:second",
      },
    ]);
  });
});

function createLargeIndexedMesh(label: string, vertexCount: number): MeshAsset {
  const data = new Float32Array(vertexCount * 8);

  for (let index = 0; index < vertexCount; index += 1) {
    const offset = index * 8;

    data[offset] = index / vertexCount;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
    data[offset + 4] = 0;
    data[offset + 5] = 1;
    data[offset + 6] = 0;
    data[offset + 7] = 0;
  }

  return {
    kind: "mesh",
    label,
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data,
      },
    ],
    indexBuffer: { format: "uint16", data: new Uint16Array([0, 1, 2]) },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount,
        indexStart: 0,
        indexCount: 3,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [0, 0, 0], max: [1, 0, 0] },
    localSphere: { center: [0.5, 0, 0], radius: 0.5 },
  };
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
