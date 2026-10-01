import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createMeshGpuUploadPlan,
  createSpatialTriangleMeshFromMeshAsset,
  createTriangleListMeshAsset,
  TriangleListMeshError,
  validateMeshAsset,
  type MeshAsset,
  type TriangleListMeshOptions,
  type TriangleListNormal,
  type TriangleListPosition,
  type TriangleListUv,
} from "@aperture-engine/render";
import {
  invalidTriangleLists,
  triangle,
} from "../helpers/triangle-list-cases.js";

function vertex(mesh: MeshAsset, index: number): number[] {
  return Array.from(
    mesh.vertexStreams[0]!.data.slice(index * 8, index * 8 + 8),
  );
}

const folded: TriangleListMeshOptions = {
  label: "Folded roof",
  positions: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  indices: [0, 1, 2, 0, 3, 1],
  uvs: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
};

describe("triangle-list authoring", () => {
  it("creates a complete standard-layout non-indexed flat triangle", () => {
    const mesh = createTriangleListMeshAsset(triangle);
    expectTypeOf(mesh).toEqualTypeOf<MeshAsset>();
    expectTypeOf<TriangleListPosition>().toEqualTypeOf<
      readonly [number, number, number]
    >();
    expectTypeOf<TriangleListNormal>().toEqualTypeOf<TriangleListPosition>();
    expectTypeOf<TriangleListUv>().toEqualTypeOf<readonly [number, number]>();
    expect(mesh).toMatchObject({
      label: "TriangleList",
      vertexStreams: [
        {
          id: "triangle-list-interleaved",
          arrayStride: 32,
          vertexCount: 3,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 0 },
            { semantic: "NORMAL", format: "float32x3", offset: 12 },
            { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
          ],
        },
      ],
      submeshes: [
        {
          label: "default",
          topology: "triangle-list",
          materialSlot: 0,
          vertexStart: 0,
          vertexCount: 3,
          indexStart: 0,
          indexCount: 0,
        },
      ],
      materialSlots: [{ index: 0, label: "default" }],
      localAabb: { min: [0, 0, 0], max: [2, 3, 0] },
      localSphere: { center: [1, 1.5, 0], radius: Math.hypot(1, 1.5) },
    });
    expect(mesh.indexBuffer).toBeUndefined();
    expect(vertex(mesh, 0)).toEqual([0, 0, 0, 0, 0, 1, 0, 0]);
    expect(validateMeshAsset(mesh)).toEqual({ valid: true, diagnostics: [] });
    expect(createMeshGpuUploadPlan(mesh)).toMatchObject({
      valid: true,
      diagnostics: [],
      plan: {
        vertexStreams: [{ byteLength: 96, vertexCount: 3 }],
        submeshes: [{ vertexCount: 3, indexCount: 0 }],
      },
    });
    expect(createSpatialTriangleMeshFromMeshAsset(mesh)).toMatchObject({
      diagnostics: [],
      mesh: { vertexCount: 3, submeshes: [{ topology: "triangle-list" }] },
    });
  });

  it("splits indexed hard edges and remaps source UVs without reordering winding", () => {
    const mesh = createTriangleListMeshAsset(folded);
    expect(mesh.label).toBe("Folded roof");
    expect(mesh.vertexStreams[0]!.vertexCount).toBe(6);
    expect(mesh.indexBuffer).toBeUndefined();
    expect(vertex(mesh, 0)).toEqual([0, 0, 0, 0, 0, 1, 0, 0]);
    expect(vertex(mesh, 3)).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(vertex(mesh, 4)).toEqual([0, 0, 1, 0, 1, 0, 1, 1]);
    expect(vertex(mesh, 5)).toEqual([1, 0, 0, 0, 1, 0, 1, 0]);
    const reversed = createTriangleListMeshAsset({
      ...triangle,
      indices: [0, 2, 1],
    });
    expect(vertex(reversed, 0).slice(3, 6)).toEqual([0, 0, -1]);
    expect(vertex(reversed, 1).slice(0, 3)).toEqual(triangle.positions[2]);
  });

  it("normalizes explicit normals and preserves shared vertices and authored UVs", () => {
    const normals = folded.positions.map(() => [0, 2, 2] as const);
    const mesh = createTriangleListMeshAsset({ ...folded, normals });
    expect(mesh.vertexStreams[0]!.vertexCount).toBe(4);
    expect(Array.from(mesh.indexBuffer!.data)).toEqual(folded.indices);
    expect(mesh.indexBuffer).toMatchObject({ format: "uint16", indexCount: 6 });
    expect(vertex(mesh, 0).slice(3, 6)).toEqual([
      0,
      Math.fround(Math.SQRT1_2),
      Math.fround(Math.SQRT1_2),
    ]);
    expect(vertex(mesh, 3).slice(6)).toEqual([1, 1]);
    expect(createMeshGpuUploadPlan(mesh).valid).toBe(true);
    expect(createSpatialTriangleMeshFromMeshAsset(mesh).mesh?.indices).toEqual(
      new Uint16Array(folded.indices!),
    );
    const unindexed = createTriangleListMeshAsset({
      ...triangle,
      normals: [
        [0, 0, -2],
        [0, 0, -2],
        [0, 0, -2],
      ],
    });
    expect(unindexed.indexBuffer).toBeUndefined();
    expect(vertex(unindexed, 0).slice(3, 6)).toEqual([0, 0, -1]);
  });

  it.each([2 ** -149, 1e-20, 1e20, 3.4028234663852886e38])(
    "normalizes explicit finite normals at magnitude %s without overflow or underflow",
    (magnitude) => {
      const mesh = createTriangleListMeshAsset({
        ...triangle,
        normals: triangle.positions.map(() => [
          magnitude,
          -magnitude,
          magnitude,
        ]),
      });
      const normal = vertex(mesh, 0).slice(3, 6);
      expect(normal.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
      expect(normal).toEqual([
        Math.fround(1 / Math.sqrt(3)),
        Math.fround(-1 / Math.sqrt(3)),
        Math.fround(1 / Math.sqrt(3)),
      ]);
    },
  );

  it("accepts frozen readonly inputs without mutating their tuples or arrays", () => {
    const positions = Object.freeze(
      triangle.positions.map((position) =>
        Object.freeze([...position] as [number, number, number]),
      ),
    );
    const indices = Object.freeze([0, 1, 2]);
    expect(
      createTriangleListMeshAsset(Object.freeze({ positions, indices })),
    ).toEqual(createTriangleListMeshAsset(triangle));
  });

  it.each([65535, 65536])(
    "selects index width using maximum referenced vertex %i",
    (maximum) => {
      const positions: TriangleListPosition[] = Array.from(
        { length: 65537 },
        () => [0, 0, 0],
      );
      positions[1] = [1, 0, 0];
      positions[maximum] = [0, 1, 0];
      const mesh = createTriangleListMeshAsset({
        positions,
        indices: new Uint32Array([0, 1, maximum]),
        normals: positions.map(() => [0, 0, 1]),
      });
      expect(mesh.indexBuffer!.format).toBe(
        maximum === 65535 ? "uint16" : "uint32",
      );
      expect(Array.from(mesh.indexBuffer!.data)).toEqual([0, 1, maximum]);
      expect(mesh.indexBuffer!.data.BYTES_PER_ELEMENT).toBe(
        maximum === 65535 ? 2 : 4,
      );
      expect(validateMeshAsset(mesh).valid).toBe(true);
    },
  );

  it("expands more than 65536 flat corners without truncating them through uint16 indices", () => {
    const mesh = createTriangleListMeshAsset({
      ...triangle,
      indices: Array.from({ length: 65538 }, (_, index) => index % 3),
    });
    expect(mesh.vertexStreams[0]!.vertexCount).toBe(65538);
    expect(mesh.indexBuffer).toBeUndefined();
    expect(vertex(mesh, 65537)).toEqual(vertex(mesh, 2));
  });

  it.each([false, true])(
    "owns all output data with explicit normals = %s",
    (explicit) => {
      const positions: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ];
      const normals: [number, number, number][] = [
        [0, 0, 2],
        [0, 0, 2],
        [0, 0, 2],
      ];
      const uvs: [number, number][] = [
        [0, 0],
        [1, 0],
        [0, 1],
      ];
      const backing = new Uint16Array([99, 0, 1, 2, 99]);
      const indices = backing.subarray(1, 4);
      const original = structuredClone({ positions, normals, uvs, backing });
      const mesh = createTriangleListMeshAsset({
        positions,
        uvs,
        indices,
        ...(explicit ? { normals } : {}),
      });
      expect({ positions, normals, uvs, backing }).toEqual(original);
      positions[0]![0] = 99;
      normals[0]![0] = 99;
      uvs[0]![0] = 99;
      backing.fill(99);
      expect(vertex(mesh, 0)).toEqual([0, 0, 0, 0, 0, 1, 0, 0]);
      if (mesh.indexBuffer !== undefined)
        expect(Array.from(mesh.indexBuffer.data)).toEqual([0, 1, 2]);
      mesh.vertexStreams[0]!.data[0] = -99;
      if (mesh.indexBuffer !== undefined) mesh.indexBuffer.data[0] = 2;
      expect(positions[0]![0]).toBe(99);
      expect(backing[1]).toBe(99);
      expect(mesh.localAabb!.min).toEqual([0, 0, 0]);
    },
  );

  it("measures bounds from stored rounded positions, discarding unused vertices only during flat expansion", () => {
    const positions: TriangleListPosition[] = [
      [0.1, 0.2, 0.3],
      [1.1, 0.2, 0.3],
      [0.1, 1.2, 0.3],
      [100, 100, 100],
    ];
    const flat = createTriangleListMeshAsset({ positions, indices: [0, 1, 2] });
    expect(flat.localAabb).toEqual({
      min: [Math.fround(0.1), Math.fround(0.2), Math.fround(0.3)],
      max: [Math.fround(1.1), Math.fround(1.2), Math.fround(0.3)],
    });
    const explicit = createTriangleListMeshAsset({
      positions,
      indices: [0, 1, 2],
      normals: positions.map(() => [0, 0, 1]),
    });
    expect(explicit.localAabb!.max).toEqual([100, 100, 100]);
  });

  it.each([2 ** -149, 1e-20, 1e20, 1e38])(
    "handles nonzero triangles at scale %s without epsilon-based face loss",
    (scale) => {
      const mesh = createTriangleListMeshAsset({
        positions: [
          [0, 0, 0],
          [scale, 0, 0],
          [0, scale, 0],
        ],
      });
      expect(vertex(mesh, 0).slice(3, 6)).toEqual([0, 0, 1]);
      expect(
        Array.from(mesh.vertexStreams[0]!.data).every(Number.isFinite),
      ).toBe(true);
      expect(mesh.localSphere!.radius).toBeGreaterThan(0);
    },
  );

  it.each(invalidTriangleLists)(
    "rejects $name with field location",
    ({ options, path }) => {
      expect(() =>
        createTriangleListMeshAsset(options as TriangleListMeshOptions),
      ).toThrow(TriangleListMeshError);
      expect(() =>
        createTriangleListMeshAsset(options as TriangleListMeshOptions),
      ).toThrow(expect.objectContaining({ path }));
    },
  );

  it("identifies the exact zero-area face and its source indices", () => {
    expect(() =>
      createTriangleListMeshAsset({ ...triangle, indices: [0, 1, 2, 2, 1, 2] }),
    ).toThrow(
      "indices[3..5] form zero-area triangle 1 (vertices 2, 1, 2) after float32 conversion",
    );
  });

  it("deterministically preserves finite geometry, orientation, attributes and bounds across seeded triangles", () => {
    let seed = 20261001;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let sample = 0; sample < 128; sample += 1) {
      const origin = [
        random() * 100 - 50,
        random() * 100 - 50,
        random() * 100 - 50,
      ] as const;
      const positions: TriangleListPosition[] = [
        origin,
        [
          origin[0] + 0.1 + random() * 5,
          origin[1] + random(),
          origin[2] + random(),
        ],
        [
          origin[0] + random(),
          origin[1] + 5 + random() * 5,
          origin[2] + random(),
        ],
      ];
      const indices = sample % 2 === 0 ? [0, 1, 2] : [0, 2, 1];
      const uvs: TriangleListUv[] = [
        [random(), random()],
        [random(), random()],
        [random(), random()],
      ];
      const options = {
        positions,
        indices,
        uvs,
      } satisfies TriangleListMeshOptions;
      const mesh = createTriangleListMeshAsset(options);
      expect(mesh).toEqual(createTriangleListMeshAsset(options));
      const a = vertex(mesh, 0),
        b = vertex(mesh, 1),
        c = vertex(mesh, 2);
      const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const ac = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      const cross = [
        ab[1]! * ac[2]! - ab[2]! * ac[1]!,
        ab[2]! * ac[0]! - ab[0]! * ac[2]!,
        ab[0]! * ac[1]! - ab[1]! * ac[0]!,
      ];
      expect(Math.hypot(...a.slice(3, 6))).toBeCloseTo(1, 6);
      expect(
        cross.reduce(
          (sum, component, axis) => sum + component * a[axis + 3]!,
          0,
        ),
      ).toBeGreaterThan(0);
      for (let corner = 0; corner < 3; corner += 1) {
        const value = vertex(mesh, corner);
        expect(value.every(Number.isFinite)).toBe(true);
        expect(value.slice(0, 3)).toEqual(
          positions[indices[corner]!]!.map(Math.fround),
        );
        expect(value.slice(3, 6)).toEqual(a.slice(3, 6));
        expect(value.slice(6)).toEqual(uvs[indices[corner]!]!.map(Math.fround));
        for (let axis = 0; axis < 3; axis += 1) {
          expect(value[axis]).toBeGreaterThanOrEqual(
            mesh.localAabb!.min[axis]!,
          );
          expect(value[axis]).toBeLessThanOrEqual(mesh.localAabb!.max[axis]!);
        }
        expect(
          Math.hypot(
            ...value
              .slice(0, 3)
              .map(
                (component, axis) =>
                  component - mesh.localSphere!.center[axis]!,
              ),
          ),
        ).toBeLessThanOrEqual(mesh.localSphere!.radius);
      }
    }
  });
});
