import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createMeshGpuUploadPlan,
  createTriangleListMeshAsset,
  TriangleListMeshError,
  type TriangleListMeshOptions,
  type TriangleListTangent,
} from "@aperture-engine/render";
import { mesh } from "@aperture-engine/app/systems";

const tuples = {
  positions: [
    [0, 0, 0],
    [2, 0, 0],
    [0, 3, 0],
  ],
  normals: [
    [0, 0, 2],
    [0, 0, 2],
    [0, 0, 2],
  ],
  uvs: [
    [0.125, 0.25],
    [0.75, 0.125],
    [0.25, 0.875],
  ],
  indices: [0, 1, 2],
} satisfies TriangleListMeshOptions;

function packedView(values: readonly number[]): Float32Array {
  const backing = new Float32Array(values.length + 4).fill(999);
  backing.set(values, 2);
  return backing.subarray(2, values.length + 2);
}

describe("packed triangle-list attributes and tangents", () => {
  it("preserves literal old layout/buffer controls with no new options", () => {
    const asset = createTriangleListMeshAsset(tuples);
    expect(asset.vertexStreams).toHaveLength(1);
    expect(asset.vertexStreams[0]!.arrayStride).toBe(32);
    expect(asset.vertexStreams[0]!.data).toEqual(
      new Float32Array([
        0, 0, 0, 0, 0, 1, 0.125, 0.25, 2, 0, 0, 0, 0, 1, 0.75, 0.125, 0, 3, 0,
        0, 0, 1, 0.25, 0.875,
      ]),
    );
    expect(asset.indexBuffer!.data).toEqual(new Uint16Array([0, 1, 2]));
    const flat = createTriangleListMeshAsset({ positions: tuples.positions });
    expect(flat.vertexStreams[0]!.data).toEqual(
      new Float32Array([
        0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0,
      ]),
    );
    expect(flat.indexBuffer).toBeUndefined();
  });

  it("matches tuple output with packed subarray inputs and retains owned source/index copies", () => {
    const positions = packedView(tuples.positions.flat());
    const normals = packedView(tuples.normals.flat());
    const uvs = packedView(tuples.uvs.flat());
    const indicesBacking = new Uint32Array([99, 0, 1, 2, 99]);
    const options = {
      positions,
      normals,
      uvs,
      indices: indicesBacking.subarray(1, 4),
    };
    const descriptor = mesh.triangleList(options);
    expect(descriptor.options).toEqual(options);
    if (descriptor.kind !== "triangle-list") {
      throw new Error("Expected the triangle-list descriptor kind.");
    }
    const asset = createTriangleListMeshAsset(descriptor.options);
    expect(asset).toEqual(createTriangleListMeshAsset(tuples));
    positions.fill(99);
    normals.fill(99);
    uvs.fill(99);
    indicesBacking.fill(99);
    expect(asset).toEqual(createTriangleListMeshAsset(tuples));
  });

  it("emits owned normalized/orthogonal tangents without changing the existing position/normal/UV stream", () => {
    expectTypeOf<TriangleListTangent>().toEqualTypeOf<
      readonly [number, number, number, number]
    >();
    const tangents = packedView([3, 0, 2, 1, 0, 4, 3, -1, 2, 2, -1, 1]);
    const asset = createTriangleListMeshAsset({ ...tuples, tangents });
    expect(asset.vertexStreams[0]).toEqual(
      createTriangleListMeshAsset(tuples).vertexStreams[0],
    );
    expect(asset.indexBuffer).toEqual(
      createTriangleListMeshAsset(tuples).indexBuffer,
    );
    expect(asset.vertexStreams[1]).toMatchObject({
      id: "triangle-list-tangents",
      arrayStride: 16,
      vertexCount: 3,
      attributes: [{ semantic: "TANGENT", format: "float32x4", offset: 0 }],
    });
    const values = asset.vertexStreams[1]!.data;
    expect(Array.from(values.slice(0, 8))).toEqual([1, 0, 0, 1, 0, 1, 0, -1]);
    expect(values[8]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(values[9]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(values[10]).toBe(0);
    expect(values[11]).toBe(1);
    tangents.fill(99);
    expect(values[3]).toBe(1);
    expect(createMeshGpuUploadPlan(asset)).toMatchObject({
      valid: true,
      diagnostics: [],
      plan: { vertexStreams: [{ byteLength: 96 }, { byteLength: 48 }] },
    });
    const tupleAsset = createTriangleListMeshAsset({
      ...tuples,
      tangents: [
        [3, 0, 2, 1],
        [0, 4, 3, -1],
        [2, 2, -1, 1],
      ],
    });
    expect(tupleAsset).toEqual(asset);
  });

  it("retains duplicate positions carrying distinct UV seams and tangent handedness", () => {
    const asset = createTriangleListMeshAsset({
      positions: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ],
      indices: [0, 1, 2, 3, 2, 1],
      normals: [
        [0, 0, 1],
        [0, 0, 1],
        [0, 0, 1],
        [0, 0, 1],
      ],
      uvs: [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      tangents: [
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [1, 0, 0, -1],
      ],
    });
    expect(asset.vertexStreams[0]!.vertexCount).toBe(4);
    expect(Array.from(asset.indexBuffer!.data)).toEqual([0, 1, 2, 3, 2, 1]);
    expect(asset.vertexStreams[0]!.data.slice(24 + 6, 24 + 8)).toEqual(
      new Float32Array([1, 1]),
    );
    expect(asset.vertexStreams[1]!.data[15]).toBe(-1);
  });

  const invalid: readonly { path: string; overrides: object }[] = [
    { path: "positions", overrides: { positions: new Float32Array(8) } },
    { path: "normals", overrides: { normals: new Float32Array(8) } },
    { path: "uvs", overrides: { uvs: new Float32Array(5) } },
    { path: "tangents", overrides: { tangents: new Float32Array(11) } },
    {
      path: "tangents[0]",
      overrides: {
        tangents: [
          [0, 0, 0, 1],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
        ],
      },
    },
    {
      path: "tangents[0]",
      overrides: {
        tangents: [
          [0, 0, 2, 1],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
        ],
      },
    },
    {
      path: "tangents[0][3]",
      overrides: {
        tangents: [
          [1, 0, 0, 0],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
        ],
      },
    },
    {
      path: "tangents[0][0]",
      overrides: {
        tangents: [
          [Infinity, 0, 0, 1],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
        ],
      },
    },
  ];
  it.each(invalid)(
    "rejects malformed packed/tangent data at $path",
    ({ path, overrides }) => {
      expect(() =>
        createTriangleListMeshAsset({
          ...tuples,
          ...overrides,
        } as TriangleListMeshOptions),
      ).toThrow(expect.objectContaining({ path }));
    },
  );

  it("rejects tangents without normals and packed shared storage", () => {
    expect(() =>
      createTriangleListMeshAsset({
        positions: tuples.positions,
        tangents: [
          [1, 0, 0, 1],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
        ],
      }),
    ).toThrow(expect.objectContaining({ path: "tangents" }));
    expect(() =>
      createTriangleListMeshAsset({
        positions: new Float32Array(new SharedArrayBuffer(36)),
      }),
    ).toThrow(TriangleListMeshError);
  });
});
