import { describe, expect, it } from "vitest";

import { createGltfMeshPrimitiveMappingReport } from "@aperture-engine/core";

describe("glTF mesh primitive mapping report", () => {
  it("plans deterministic mesh handles for a valid triangle primitive", () => {
    const report = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}, {}, {}, {}, {}, {}],
        meshes: [
          {
            name: "Cube",
            primitives: [
              {
                attributes: {
                  POSITION: 0,
                  NORMAL: 1,
                  TEXCOORD_0: 2,
                  JOINTS_0: 3,
                  WEIGHTS_0: 4,
                },
                indices: 5,
                material: 4,
              },
            ],
          },
        ],
      },
    });

    expect(report.valid).toBe(true);
    expect(report.meshes).toMatchObject([
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        label: "Cube.primitive.0",
        topology: "triangle-list",
        attributes: {
          position: { semantic: "POSITION", accessorIndex: 0 },
          normal: { semantic: "NORMAL", accessorIndex: 1 },
          texcoord0: { semantic: "TEXCOORD_0", accessorIndex: 2 },
          joints0: { semantic: "JOINTS_0", accessorIndex: 3 },
          weights0: { semantic: "WEIGHTS_0", accessorIndex: 4 },
        },
        indices: { accessorIndex: 5 },
        materialIndex: 4,
        mesh: null,
      },
    ]);
    expect(report.diagnostics).toMatchObject([
      {
        layer: "mesh",
        code: "gltfMesh.unresolvedAccessorData",
        severity: "warning",
        meshIndex: 0,
        primitiveIndex: 0,
      },
    ]);
  });

  it("reports missing POSITION and unsupported primitive modes", () => {
    const report = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}],
        meshes: [
          {
            primitives: [
              {
                mode: 5,
                attributes: {
                  NORMAL: 0,
                },
              },
            ],
          },
        ],
      },
    });

    expect(report.valid).toBe(false);
    expect(report.meshes).toEqual([]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMesh.unsupportedPrimitiveMode",
        severity: "warning",
        mode: 5,
      },
      {
        code: "gltfMesh.missingPosition",
        severity: "error",
        attribute: "POSITION",
      },
    ]);
  });

  it("skips unsupported primitive modes without blocking supported primitive plans", () => {
    const report = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}, {}, {}],
        meshes: [
          {
            primitives: [
              {
                attributes: { POSITION: 0, NORMAL: 1 },
                indices: 2,
              },
              {
                mode: 1,
                attributes: { POSITION: 0 },
              },
            ],
          },
        ],
      },
    });

    expect(report.valid).toBe(true);
    expect(report.meshes).toMatchObject([
      {
        meshIndex: 0,
        primitiveIndex: 0,
        topology: "triangle-list",
      },
    ]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMesh.unresolvedAccessorData",
        severity: "warning",
        primitiveIndex: 0,
      },
      {
        code: "gltfMesh.unsupportedPrimitiveMode",
        severity: "warning",
        primitiveIndex: 1,
        mode: 1,
      },
    ]);
  });

  it("reports missing mesh and primitive reference selections", () => {
    const missingMesh = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        meshes: [],
      },
      meshPrimitiveIndices: [{ meshIndex: 0, primitiveIndex: 0 }],
    });
    const missingPrimitive = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        meshes: [{ primitives: [] }],
      },
      meshPrimitiveIndices: [{ meshIndex: 0, primitiveIndex: 0 }],
    });

    expect(missingMesh.valid).toBe(false);
    expect(missingMesh.diagnostics).toMatchObject([
      {
        code: "gltfMesh.missingMesh",
        severity: "error",
        meshIndex: 0,
      },
    ]);
    expect(missingPrimitive.valid).toBe(false);
    expect(missingPrimitive.diagnostics).toMatchObject([
      {
        code: "gltfMesh.missingPrimitive",
        severity: "error",
        meshIndex: 0,
        primitiveIndex: 0,
      },
    ]);
  });

  it("reports unresolved accessor references without decoding buffers", () => {
    const report = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [],
        meshes: [
          {
            primitives: [
              {
                attributes: {
                  POSITION: 0,
                },
                indices: 1,
              },
            ],
          },
        ],
      },
    });

    expect(report.valid).toBe(false);
    expect(report.meshes).toEqual([]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMesh.invalidAccessorReference",
        severity: "error",
        attribute: "POSITION",
        accessorIndex: 0,
      },
      {
        code: "gltfMesh.invalidAccessorReference",
        severity: "error",
        accessorIndex: 1,
      },
    ]);
  });
});
