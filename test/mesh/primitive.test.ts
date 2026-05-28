import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createTorusMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";

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

  it("builds sphere mesh data with expected segments, indices, normals, uvs, and bounds", () => {
    const sphere = createSphereMeshAsset({
      label: "TestSphere",
      radius: 2,
      widthSegments: 8,
      heightSegments: 4,
    });
    const stream = required(sphere.vertexStreams[0]);

    expect(sphere.label).toBe("TestSphere");
    expect(stream.vertexCount).toBe(45);
    expect(stream.arrayStride).toBe(32);
    expect(stream.data.length).toBe(45 * 8);
    expect(vertex(stream.data, 0)).toEqual([0, 2, 0, 0, 1, 0, 0, 0]);
    expectVectorClose(vertex(stream.data, 18), [2, 0, 0, 1, 0, 0, 0, 0.5]);
    expect(sphere.indexBuffer?.format).toBe("uint16");
    expect(sphere.indexBuffer?.data.length).toBe(144);
    expect(Array.from(sphere.indexBuffer?.data.slice(0, 3) ?? [])).toEqual([
      1, 9, 10,
    ]);
    expect(
      Math.max(...Array.from(sphere.indexBuffer?.data ?? [])),
    ).toBeLessThan(stream.vertexCount);
    expect(sphere.submeshes[0]).toMatchObject({
      topology: "triangle-list",
      materialSlot: 0,
      vertexStart: 0,
      vertexCount: 45,
      indexStart: 0,
      indexCount: 144,
    });
    expect(sphere.localAabb).toEqual({
      min: [-2, -2, -2],
      max: [2, 2, 2],
    });
    expect(sphere.localSphere).toEqual({ center: [0, 0, 0], radius: 2 });
    expect(validateMeshAsset(sphere)).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("clamps sphere options to valid primitive ranges", () => {
    const sphere = createSphereMeshAsset({
      radius: -1,
      widthSegments: 1,
      heightSegments: 1,
    });

    expect(sphere.vertexStreams[0]?.vertexCount).toBe(12);
    expect(sphere.indexBuffer?.data.length).toBe(18);
    expect(sphere.localAabb).toEqual({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    });
    expect(validateMeshAsset(sphere)).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("builds cylinder mesh data with sides, caps, bounds, and valid indices", () => {
    const cylinder = createCylinderMeshAsset({
      label: "TestCylinder",
      radius: 1,
      height: 2,
      radialSegments: 8,
      heightSegments: 2,
    });
    const stream = required(cylinder.vertexStreams[0]);

    expect(cylinder.label).toBe("TestCylinder");
    expect(stream.vertexCount).toBe(47);
    expect(vertex(stream.data, 0)).toEqual([1, -1, 0, 1, 0, 0, 0, 0]);
    expect(vertex(stream.data, 27)).toEqual([0, 1, 0, 0, 1, 0, 0.5, 0.5]);
    expect(cylinder.indexBuffer?.data.length).toBe(144);
    expect(
      Math.max(...Array.from(cylinder.indexBuffer?.data ?? [])),
    ).toBeLessThan(stream.vertexCount);
    expect(cylinder.submeshes[0]).toMatchObject({
      topology: "triangle-list",
      vertexCount: 47,
      indexCount: 144,
    });
    expect(cylinder.localAabb).toEqual({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    });
    expect(cylinder.localSphere?.radius).toBeCloseTo(Math.sqrt(2), 5);
    expect(validateMeshAsset(cylinder)).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("builds cone mesh data with side taper, bottom cap, bounds, and valid indices", () => {
    const cone = createConeMeshAsset({
      label: "TestCone",
      radius: 1,
      height: 2,
      radialSegments: 8,
      heightSegments: 2,
    });
    const stream = required(cone.vertexStreams[0]);

    expect(cone.label).toBe("TestCone");
    expect(stream.vertexCount).toBe(37);
    expectVectorClose(
      vertex(stream.data, 0),
      [1, -1, 0, 0.894_427, 0.447_214, 0, 0, 0],
    );
    expectVectorClose(vertex(stream.data, 18).slice(0, 3), [0, 1, 0]);
    expect(cone.indexBuffer?.data.length).toBe(96);
    expect(Math.max(...Array.from(cone.indexBuffer?.data ?? []))).toBeLessThan(
      stream.vertexCount,
    );
    expect(cone.submeshes[0]).toMatchObject({
      topology: "triangle-list",
      vertexCount: 37,
      indexCount: 96,
    });
    expect(cone.localAabb).toEqual({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    });
    expect(cone.localSphere?.radius).toBeCloseTo(Math.sqrt(2), 5);
    expect(validateMeshAsset(cone)).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("builds capsule mesh data with hemispheres, body ring, bounds, and valid indices", () => {
    const capsule = createCapsuleMeshAsset({
      label: "TestCapsule",
      radius: 1,
      height: 4,
      radialSegments: 8,
      capSegments: 4,
    });
    const stream = required(capsule.vertexStreams[0]);

    expect(capsule.label).toBe("TestCapsule");
    expect(stream.vertexCount).toBe(90);
    expectVectorClose(vertex(stream.data, 0), [0, -2, 0, 0, -1, 0, 0, 0]);
    expectVectorClose(vertex(stream.data, 36), [1, -1, 0, 1, 0, 0, 0, 4 / 9]);
    expectVectorClose(vertex(stream.data, 45), [1, 1, 0, 1, 0, 0, 0, 5 / 9]);
    expect(capsule.indexBuffer?.data.length).toBe(384);
    expect(
      Math.max(...Array.from(capsule.indexBuffer?.data ?? [])),
    ).toBeLessThan(stream.vertexCount);
    expect(capsule.localAabb).toEqual({
      min: [-1, -2, -1],
      max: [1, 2, 1],
    });
    expect(capsule.localSphere).toEqual({ center: [0, 0, 0], radius: 2 });
    expect(validateMeshAsset(capsule)).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("builds torus mesh data with tube rings, bounds, and valid indices", () => {
    const torus = createTorusMeshAsset({
      label: "TestTorus",
      majorRadius: 2,
      tubeRadius: 0.5,
      radialSegments: 8,
      tubeSegments: 4,
    });
    const stream = required(torus.vertexStreams[0]);

    expect(torus.label).toBe("TestTorus");
    expect(stream.vertexCount).toBe(45);
    expect(vertex(stream.data, 0)).toEqual([2.5, 0, 0, 1, 0, 0, 0, 0]);
    expectVectorClose(vertex(stream.data, 1), [2, 0.5, 0, 0, 1, 0, 0, 0.25]);
    expect(torus.indexBuffer?.data.length).toBe(192);
    expect(Math.max(...Array.from(torus.indexBuffer?.data ?? []))).toBeLessThan(
      stream.vertexCount,
    );
    expect(torus.localAabb).toEqual({
      min: [-2.5, -0.5, -2.5],
      max: [2.5, 0.5, 2.5],
    });
    expect(torus.localSphere).toEqual({ center: [0, 0, 0], radius: 2.5 });
    expect(validateMeshAsset(torus)).toEqual({
      valid: true,
      diagnostics: [],
    });
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
          topology: "line-strip",
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

function vertex(data: Float32Array | Uint16Array | Uint8Array, index: number) {
  return Array.from(data.slice(index * 8, index * 8 + 8));
}

function expectVectorClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);

  for (const [index, value] of actual.entries()) {
    expect(value).toBeCloseTo(required(expected[index]), 5);
  }
}
