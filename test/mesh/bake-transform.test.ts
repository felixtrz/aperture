import { describe, expect, expectTypeOf, it } from "vitest";
import {
  bakeMeshAssetTransform,
  createBoxMeshAsset,
  createMeshGpuUploadPlan,
  createSpatialTriangleMeshFromMeshAsset,
  createTriangleListMeshAsset,
  mergeMeshAssetsForBatch,
  MESH_BAKE_TRANSFORM_LIMITS,
  type BakeMeshAssetTransformResult,
  type MeshAsset,
  type MeshVertexSemantic,
} from "@aperture-engine/render";
import { createMeshHandle } from "@aperture-engine/simulation";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mirror = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function triangle(indexed = true): MeshAsset {
  return createTriangleListMeshAsset({
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    normals: [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0.125, 0.25],
      [0.75, 0.125],
      [0.25, 0.875],
    ],
    tangents: [
      [1, 0, 0, 1],
      [1, 0, 0, -1],
      [1, 0, 0, 1],
    ],
    ...(indexed ? { indices: [0, 1, 2] } : {}),
  });
}

function baked(mesh: MeshAsset, transform = identity): MeshAsset {
  const result = bakeMeshAssetTransform({ mesh, transform });
  expect(result.diagnostics).toEqual([]);
  if (!result.valid || result.mesh === null)
    throw new Error("Expected successful test bake.");
  return result.mesh;
}

function attribute(
  mesh: MeshAsset,
  semantic: MeshVertexSemantic,
  vertex: number,
): number[] {
  for (const stream of mesh.vertexStreams) {
    const descriptor = stream.attributes.find(
      (item) => item.semantic === semantic,
    );
    if (descriptor === undefined) continue;
    const view = new DataView(
      stream.data.buffer,
      stream.data.byteOffset,
      stream.data.byteLength,
    );
    const offset = vertex * stream.arrayStride + descriptor.offset;
    const components =
      descriptor.format === "float32x2"
        ? 2
        : descriptor.format === "float32x4"
          ? 4
          : 3;
    return Array.from({ length: components }, (_, index) =>
      view.getFloat32(offset + index * 4, true),
    );
  }
  throw new Error(`Missing ${semantic} in test fixture.`);
}

function rejected(mesh: MeshAsset, code: string, transform = identity): void {
  expect(bakeMeshAssetTransform({ mesh, transform })).toMatchObject({
    valid: false,
    mesh: null,
    diagnostics: [{ code, severity: "error" }],
  });
}

describe("static affine mesh bake", () => {
  it("owns indexed buffers/metadata, clears update hints, and preserves a primitive identity bake", () => {
    const primitive = createBoxMeshAsset();
    const mesh: MeshAsset = {
      ...primitive,
      vertexStreams: primitive.vertexStreams.map((stream) => ({
        ...stream,
        updateRanges: [{ byteOffset: 0, byteLength: 4 }],
      })),
      indexBuffer: {
        ...primitive.indexBuffer!,
        updateRanges: [{ byteOffset: 0, byteLength: 2 }],
      },
    };
    const original = structuredClone(mesh);
    const result = bakeMeshAssetTransform({
      mesh,
      transform: new Float64Array(identity),
      label: "Owned",
    });
    expectTypeOf(result).toEqualTypeOf<BakeMeshAssetTransformResult>();
    expect(result.valid).toBe(true);
    const output = result.mesh!;
    expect(mesh).toEqual(original);
    expect(output.vertexStreams[0]!.data).toEqual(
      primitive.vertexStreams[0]!.data,
    );
    expect(output.indexBuffer!.data).toEqual(primitive.indexBuffer!.data);
    expect(output.vertexStreams[0]!.data.buffer).not.toBe(
      mesh.vertexStreams[0]!.data.buffer,
    );
    expect(output.indexBuffer!.data.buffer).not.toBe(
      mesh.indexBuffer!.data.buffer,
    );
    expect(output.submeshes[0]).not.toBe(mesh.submeshes[0]);
    expect(output.materialSlots[0]).not.toBe(mesh.materialSlots[0]);
    expect(output.vertexStreams[0]!.attributes[0]).not.toBe(
      mesh.vertexStreams[0]!.attributes[0],
    );
    expect(output.vertexStreams[0]!.updateRanges).toBeUndefined();
    expect(output.indexBuffer!.updateRanges).toBeUndefined();
    expect(output.label).toBe("Owned");
    output.vertexStreams[0]!.data.fill(99);
    output.indexBuffer!.data.fill(0);
    expect(mesh).toEqual(original);
  });

  it("uses inverse-transpose normals and orthogonal tangent vectors under shear/nonuniform scale", () => {
    const mesh = createTriangleListMeshAsset({
      positions: [
        [0, 0, 0],
        [1, 0, 1],
        [0, 1, 1],
      ],
      indices: [0, 1, 2],
      normals: [
        [-1, -1, 1],
        [-1, -1, 1],
        [-1, -1, 1],
      ],
      tangents: [
        [1, 0, 1, 1],
        [1, 0, 1, 1],
        [1, 0, 1, 1],
      ],
    });
    const output = baked(
      mesh,
      [2, 0, 0, 0, 1, 3, 0, 0, 0.5, 0, 4, 0, 5, -2, 1, 1],
    );
    expect(attribute(output, "POSITION", 1)).toEqual([7.5, -2, 5]);
    expect(attribute(output, "POSITION", 2)).toEqual([6.5, 1, 5]);
    const expected = [-0.5, -1 / 6, 0.3125];
    const normal = attribute(output, "NORMAL", 0);
    expected.forEach((value, index) =>
      expect(normal[index]).toBeCloseTo(value / Math.hypot(...expected), 6),
    );
    const tangent = attribute(output, "TANGENT", 0);
    expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
    expect(Math.hypot(...tangent.slice(0, 3))).toBeCloseTo(1, 6);
    expect(
      normal.reduce((sum, value, index) => sum + value * tangent[index]!, 0),
    ).toBeCloseTo(0, 6);
    expect(tangent[3]).toBe(1);
    expect(output.indexBuffer!.data).toEqual(mesh.indexBuffer!.data);
    expect(output.localAabb).toEqual({ min: [5, -2, 1], max: [7.5, 1, 5] });
  });

  it("corrects mirrored indexed winding/handedness while preserving seams and material/range metadata", () => {
    const original = triangle();
    const output = baked(original, mirror);
    expect(Array.from(output.indexBuffer!.data)).toEqual([0, 2, 1]);
    expect(attribute(output, "NORMAL", 0)).toEqual([0, 0, 1]);
    expect(attribute(output, "TANGENT", 1)).toEqual([-1, 0, 0, 1]);
    expect(attribute(output, "TEXCOORD_0", 1)).toEqual(
      attribute(original, "TEXCOORD_0", 1),
    );
    expect(output.submeshes).toEqual(original.submeshes);
    expect(output.materialSlots).toEqual(original.materialSlots);
    expect(createMeshGpuUploadPlan(output).valid).toBe(true);
    expect(
      createSpatialTriangleMeshFromMeshAsset(output).mesh?.indices,
    ).toEqual(new Uint16Array([0, 2, 1]));
  });

  it("mirrors entire nonindexed records across every stream, including asymmetric UV and packed color", () => {
    const base = triangle(false);
    const color = new Uint8Array([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24]);
    const source: MeshAsset = {
      ...base,
      vertexStreams: [
        ...base.vertexStreams,
        {
          id: "color",
          arrayStride: 4,
          vertexCount: 3,
          attributes: [{ semantic: "COLOR_0", format: "unorm8x4", offset: 0 }],
          data: color,
        },
      ],
    };
    const output = baked(source, mirror);
    expect(output.indexBuffer).toBeUndefined();
    expect(attribute(output, "POSITION", 1)).toEqual([0, 1, 0]);
    expect(attribute(output, "TEXCOORD_0", 1)).toEqual(
      attribute(source, "TEXCOORD_0", 2),
    );
    expect(attribute(output, "TANGENT", 1)).toEqual([-1, 0, 0, -1]);
    expect(output.vertexStreams[2]!.data).toEqual(
      new Uint8Array([1, 2, 3, 4, 21, 22, 23, 24, 11, 12, 13, 14]),
    );
    expect(source.vertexStreams[2]!.data).toEqual(color);
  });

  it.each([false, true])(
    "flips shared/overlapping triangle ranges once (indexed=%s)",
    (indexed) => {
      const base = triangle(indexed);
      const stream = base.vertexStreams[0]!;
      const data = indexed
        ? stream.data
        : new Float32Array([...stream.data, ...stream.data, ...stream.data]);
      const source: MeshAsset = {
        ...base,
        vertexStreams: [{ ...stream, data, vertexCount: indexed ? 3 : 9 }],
        ...(indexed
          ? {
              indexBuffer: {
                format: "uint16",
                data: new Uint16Array([0, 1, 2, 0, 1, 2, 0, 1, 2]),
              },
            }
          : {}),
        submeshes: [
          [0, 6],
          [3, 6],
          [0, 3],
        ].map(([start, count], index) => ({
          ...base.submeshes[0]!,
          label: `${index}`,
          vertexStart: indexed ? 0 : start!,
          vertexCount: indexed ? 3 : count!,
          indexStart: indexed ? start! : 0,
          indexCount: indexed ? count! : 0,
        })),
      };
      const output = baked(source, mirror);
      expect(output.submeshes).toEqual(source.submeshes);
      if (indexed)
        expect(Array.from(output.indexBuffer!.data)).toEqual([
          0, 2, 1, 0, 2, 1, 0, 2, 1,
        ]);
      else
        for (const corner of [1, 4, 7])
          expect(attribute(output, "POSITION", corner)).toEqual([0, 1, 0]);
    },
  );

  it("rejects mirrored ranges overlapping different triplets, retaining valid positive-transform ranges", () => {
    const base = triangle();
    const source: MeshAsset = {
      ...base,
      indexBuffer: {
        format: "uint16",
        data: new Uint16Array([0, 1, 2, 0, 1, 2]),
      },
      submeshes: [0, 1].map((indexStart) => ({
        ...base.submeshes[0]!,
        indexStart,
      })),
    };
    expect(
      bakeMeshAssetTransform({ mesh: source, transform: identity }).valid,
    ).toBe(true);
    const result = bakeMeshAssetTransform({ mesh: source, transform: mirror });
    expect(result).toMatchObject({
      valid: false,
      mesh: null,
      diagnostics: [
        { code: "meshBake.unsupportedLayout", path: "mesh.submeshes" },
      ],
    });
    expect(result.diagnostics[0]!.message).toContain(
      "different triangle triplets",
    );
    expect(Array.from(source.indexBuffer!.data)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("reads nonzero byte-offset interleaved views and preserves passive bytes, padding and index tails", () => {
    const backing = new Uint8Array(7 + 120 + 9).fill(213);
    const data = backing.subarray(7, 127);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const positions = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    for (let vertex = 0; vertex < 3; vertex += 1) {
      [...positions[vertex]!, 0, 0, 1, 0.125 * vertex, 0.25 * vertex].forEach(
        (value, component) =>
          view.setFloat32(vertex * 40 + component * 4, value, true),
      );
      data.set([vertex, 20, 30, 255], vertex * 40 + 32);
    }
    const indexBacking = new Uint32Array([99, 0, 1, 2, 2, 1, 0, 99]);
    const source: MeshAsset = {
      ...triangle(),
      vertexStreams: [
        {
          id: "raw",
          data,
          arrayStride: 40,
          vertexCount: 3,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 0 },
            { semantic: "NORMAL", format: "float32x3", offset: 12 },
            { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
            { semantic: "COLOR_0", format: "unorm8x4", offset: 32 },
          ],
        },
      ],
      indexBuffer: {
        format: "uint32",
        data: indexBacking.subarray(1, 7),
        indexCount: 3,
      },
    };
    const original = new Uint8Array(backing);
    const output = baked(
      source,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1],
    );
    expect(output.vertexStreams[0]!.data).toBeInstanceOf(Uint8Array);
    expect(output.vertexStreams[0]!.data.byteOffset).toBe(0);
    expect(attribute(output, "POSITION", 2)).toEqual([2, 4, 4]);
    const bytes = output.vertexStreams[0]!.data;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      expect(bytes.slice(vertex * 40 + 24, vertex * 40 + 40)).toEqual(
        data.slice(vertex * 40 + 24, vertex * 40 + 40),
      );
    }
    expect(output.indexBuffer).toMatchObject({
      format: "uint32",
      indexCount: 3,
    });
    expect(output.indexBuffer!.data).toEqual(
      new Uint32Array([0, 1, 2, 2, 1, 0]),
    );
    expect(backing).toEqual(original);
    expect(indexBacking).toEqual(new Uint32Array([99, 0, 1, 2, 2, 1, 0, 99]));
  });

  it("feeds existing merge with indexed rebasing, bounds, compatible layouts and source range mapping", () => {
    const box = createBoxMeshAsset();
    const transformed = baked(
      box,
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1],
    );
    const result = mergeMeshAssetsForBatch({
      sources: [
        { handle: createMeshHandle("a"), mesh: box },
        { handle: createMeshHandle("b"), mesh: transformed },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.mesh!.vertexStreams[0]!.vertexCount).toBe(48);
    expect(result.mesh!.indexBuffer!.data[36]).toBe(
      transformed.indexBuffer!.data[0]! + 24,
    );
    expect(result.mesh!.localAabb).toEqual({
      min: [-0.5, -0.5, -0.5],
      max: [4, 0.5, 0.5],
    });
    expect(result.ranges.map((range) => range.sourceMeshKey)).toEqual([
      "mesh:a",
      "mesh:b",
    ]);
  });

  it("rejects singular/nonaffine/nonfinite transforms and float32 collapse without a partial result", () => {
    const mesh = triangle();
    rejected(
      mesh,
      "meshBake.singularTransform",
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    );
    rejected(mesh, "meshBake.invalidTransform", identity.slice(1));
    const projective = [...identity];
    projective[3] = 0.1;
    rejected(mesh, "meshBake.invalidTransform", projective);
    const nonfinite = [...identity];
    nonfinite[12] = Infinity;
    rejected(mesh, "meshBake.invalidTransform", nonfinite);
    const collapse = [...identity];
    collapse[12] = 2 ** 30;
    rejected(mesh, "meshBake.degenerateTriangle", collapse);
    const overflow = [...identity];
    overflow[12] = 1e39;
    rejected(mesh, "meshBake.nonFiniteOutput", overflow);
  });

  it("rejects deformation/unsupported layouts, invalid normals/tangents, indices and bounded work", () => {
    const mesh = triangle();
    rejected({ ...mesh, skinning: {} }, "meshBake.unsupportedLayout");
    rejected({ ...mesh, morphTargets: [] }, "meshBake.unsupportedLayout");
    rejected(
      {
        ...mesh,
        submeshes: [{ ...mesh.submeshes[0]!, topology: "triangle-strip" }],
      },
      "meshBake.unsupportedLayout",
    );
    const first = mesh.vertexStreams[0]!;
    rejected(
      {
        ...mesh,
        vertexStreams: [
          {
            ...first,
            attributes: [
              { semantic: "POSITION", format: "float32x4", offset: 0 },
            ],
          },
        ],
      },
      "meshBake.unsupportedLayout",
    );
    rejected(
      {
        ...mesh,
        vertexStreams: [
          {
            ...first,
            attributes: [
              ...first.attributes,
              { semantic: "COLOR_0", format: "unorm8x4", offset: 0 },
            ],
          },
        ],
      },
      "meshBake.unsupportedLayout",
    );
    rejected(
      {
        ...mesh,
        indexBuffer: { format: "uint16", data: new Uint16Array([0, 1, 3]) },
      },
      "meshBake.limitExceeded",
    );
    rejected(
      {
        ...mesh,
        vertexStreams: [
          { ...first, vertexCount: MESH_BAKE_TRANSFORM_LIMITS.vertices + 1 },
        ],
      },
      "meshBake.limitExceeded",
    );
    const invalid = structuredClone(mesh);
    invalid.vertexStreams[0]!.data[3] = 0;
    invalid.vertexStreams[0]!.data[4] = 0;
    invalid.vertexStreams[0]!.data[5] = 0;
    rejected(invalid, "meshBake.invalidSourceMesh");
    const tangent = structuredClone(mesh);
    tangent.vertexStreams[1]!.data[3] = 0;
    rejected(tangent, "meshBake.invalidSourceMesh");
    const shared: MeshAsset = {
      ...mesh,
      vertexStreams: [
        {
          ...first,
          data: new Float32Array(new SharedArrayBuffer(first.data.byteLength)),
        },
      ],
    };
    rejected(shared, "meshBake.unsupportedLayout");
  });
});
