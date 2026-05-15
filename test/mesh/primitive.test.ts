import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createPlaneMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "../../src/index.js";

describe("mesh asset schema and primitive builders", () => {
  it("builds box mesh data with interleaved attributes, indices, submesh, and bounds", () => {
    const box = createBoxMeshAsset();

    expect(box.kind).toBe("mesh");
    expect(box.vertexStreams).toHaveLength(1);
    expect(box.vertexStreams[0]?.vertexCount).toBe(24);
    expect(box.vertexStreams[0]?.arrayStride).toBe(32);
    expect(
      box.vertexStreams[0]?.attributes.map((attribute) => attribute.semantic),
    ).toEqual(["POSITION", "NORMAL", "TEXCOORD_0"]);
    expect(box.vertexStreams[0]?.data.length).toBe(24 * 8);
    expect(Array.from(box.vertexStreams[0]?.data.slice(0, 8) ?? [])).toEqual([
      -0.5, -0.5, 0.5, 0, 0, 1, 0, 0,
    ]);
    expect(box.indexBuffer?.format).toBe("uint16");
    expect(box.indexBuffer?.data.length).toBe(36);
    expect(Array.from(box.indexBuffer?.data.slice(0, 6) ?? [])).toEqual([
      0, 1, 2, 0, 2, 3,
    ]);
    expect(box.submeshes[0]).toMatchObject({
      topology: "triangle-list",
      materialSlot: 0,
      vertexStart: 0,
      vertexCount: 24,
      indexStart: 0,
      indexCount: 36,
    });
    expect(box.localAabb).toEqual({
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    });
    expect(box.localSphere?.radius).toBeCloseTo(Math.sqrt(0.75), 5);
    expect(validateMeshAsset(box)).toEqual({ valid: true, diagnostics: [] });
  });

  it("builds plane mesh data with expected vertices, indices, submesh, and bounds", () => {
    const plane = createPlaneMeshAsset({ width: 2, height: 4 });

    expect(plane.vertexStreams[0]?.vertexCount).toBe(4);
    expect(plane.vertexStreams[0]?.data.length).toBe(4 * 8);
    expect(Array.from(plane.vertexStreams[0]?.data.slice(0, 8) ?? [])).toEqual([
      -1, -2, 0, 0, 0, 1, 0, 0,
    ]);
    expect(Array.from(plane.indexBuffer?.data ?? [])).toEqual([
      0, 1, 2, 0, 2, 3,
    ]);
    expect(plane.submeshes[0]).toMatchObject({
      topology: "triangle-list",
      vertexStart: 0,
      vertexCount: 4,
      indexStart: 0,
      indexCount: 6,
    });
    expect(plane.localAabb).toEqual({ min: [-1, -2, 0], max: [1, 2, 0] });
    expect(plane.localSphere?.radius).toBeCloseTo(Math.sqrt(5), 5);
    expect(validateMeshAsset(plane)).toEqual({ valid: true, diagnostics: [] });
  });

  it("validates missing position attributes, invalid ranges, unsupported topologies, and missing bounds", () => {
    const plane = createPlaneMeshAsset();
    const invalid = withoutBounds({
      ...plane,
      vertexStreams: [
        {
          ...required(plane.vertexStreams[0]),
          attributes: required(plane.vertexStreams[0]).attributes.filter(
            (attribute) => attribute.semantic !== "POSITION",
          ),
        },
      ],
      submeshes: [
        {
          ...required(plane.submeshes[0]),
          topology: "line-list",
          materialSlot: 5,
          indexStart: 99,
          indexCount: 6,
        },
      ],
    });

    expect(
      validateMeshAsset(invalid).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "mesh.missingPosition",
      "mesh.missingBounds",
      "mesh.unsupportedTopology",
      "mesh.missingMaterialSlot",
      "mesh.invalidSubmeshRange",
    ]);
  });
});

function withoutBounds(mesh: MeshAsset): MeshAsset {
  const { localAabb: _localAabb, localSphere: _localSphere, ...rest } = mesh;

  return rest;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
