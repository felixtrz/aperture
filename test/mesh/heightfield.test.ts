import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createHeightfieldMeshAsset,
  createMeshGpuUploadPlan,
  createSpatialTriangleMeshFromMeshAsset,
  HeightfieldMeshError,
  validateMeshAsset,
  type HeightfieldMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  flatHeightfield,
  invalidHeightfields,
} from "../helpers/heightfield-cases.js";

function vertices(mesh: MeshAsset): number[][] {
  const stream = mesh.vertexStreams[0]!;
  return Array.from({ length: stream.vertexCount }, (_, index) =>
    Array.from(stream.data.slice(index * 8, index * 8 + 8)),
  );
}

function cross(a: number[], b: number[], c: number[]): number[] {
  const ab = b.slice(0, 3).map((value, axis) => value - a[axis]!);
  const ac = c.slice(0, 3).map((value, axis) => value - a[axis]!);
  return [
    ab[1]! * ac[2]! - ab[2]! * ac[1]!,
    ab[2]! * ac[0]! - ab[0]! * ac[2]!,
    ab[0]! * ac[1]! - ab[1]! * ac[0]!,
  ];
}

describe("heightfield authoring", () => {
  it("creates a standard-layout, upward-facing unit surface with exact UVs", () => {
    const mesh = createHeightfieldMeshAsset(flatHeightfield);
    expectTypeOf(mesh).toEqualTypeOf<MeshAsset>();
    expectTypeOf(createHeightfieldMeshAsset)
      .parameter(0)
      .toEqualTypeOf<HeightfieldMeshOptions>();
    expect(mesh.label).toBe("Heightfield");
    expect(mesh.indexBuffer).toBeUndefined();
    expect(mesh.vertexStreams[0]).toMatchObject({
      arrayStride: 32,
      vertexCount: 6,
    });
    expect(mesh.localAabb).toEqual({
      min: [-0.5, 0, -0.5],
      max: [0.5, 0, 0.5],
    });
    expect(mesh.localSphere).toEqual({
      center: [0, 0, 0],
      radius: Math.SQRT1_2,
    });
    expect(vertices(mesh)).toEqual([
      [-0.5, 0, -0.5, 0, 1, 0, 0, 0],
      [-0.5, 0, 0.5, 0, 1, 0, 0, 1],
      [0.5, 0, 0.5, 0, 1, 0, 1, 1],
      [-0.5, 0, -0.5, 0, 1, 0, 0, 0],
      [0.5, 0, 0.5, 0, 1, 0, 1, 1],
      [0.5, 0, -0.5, 0, 1, 0, 1, 0],
    ]);
    expect(validateMeshAsset(mesh)).toEqual({ valid: true, diagnostics: [] });
    expect(createMeshGpuUploadPlan(mesh)).toMatchObject({
      valid: true,
      diagnostics: [],
      plan: { vertexStreams: [{ byteLength: 192, vertexCount: 6 }] },
    });
    expect(createSpatialTriangleMeshFromMeshAsset(mesh)).toMatchObject({
      diagnostics: [],
      mesh: { vertexCount: 6, submeshes: [{ topology: "triangle-list" }] },
    });
  });

  it("uses raw Y heights, centered rectangular extents, and row +Z / column +X", () => {
    const mesh = createHeightfieldMeshAsset({
      label: "Slope",
      width: 4,
      depth: 6,
      heights: [
        [10, 11, 12],
        [13, 14, 15],
      ],
    });
    expect(mesh.label).toBe("Slope");
    expect(mesh.localAabb).toEqual({ min: [-2, 10, -3], max: [2, 15, 3] });
    const data = vertices(mesh);
    expect(data.map((vertex) => vertex.slice(0, 3))).toEqual([
      [-2, 10, -3],
      [-2, 13, 3],
      [0, 14, 3],
      [-2, 10, -3],
      [0, 14, 3],
      [0, 11, -3],
      [0, 11, -3],
      [0, 14, 3],
      [2, 15, 3],
      [0, 11, -3],
      [2, 15, 3],
      [2, 12, -3],
    ]);
    for (const vertex of data) {
      expect(vertex[3]).toBeCloseTo(-1 / Math.sqrt(6), 6);
      expect(vertex[4]).toBeCloseTo(2 / Math.sqrt(6), 6);
      expect(vertex[5]).toBeCloseTo(-1 / Math.sqrt(6), 6);
    }
    expect(data[2]!.slice(6)).toEqual([0.5, 1]);
  });

  it("keeps the explicit (r,c) to (r+1,c+1) diagonal and flat normals at a saddle", () => {
    const data = vertices(
      createHeightfieldMeshAsset({
        heights: [
          [0, 1],
          [2, 0],
        ],
      }),
    );
    expect(data.slice(0, 3).map((vertex) => vertex[1])).toEqual([0, 2, 0]);
    expect(data.slice(3).map((vertex) => vertex[1])).toEqual([0, 0, 1]);
    expect(data[0]!.slice(3, 6)).toEqual(data[1]!.slice(3, 6));
    expect(data[3]!.slice(3, 6)).toEqual(data[4]!.slice(3, 6));
    expect(data[0]!.slice(3, 6)).not.toEqual(data[3]!.slice(3, 6));
    expect(data[0]!.slice(0, 3)).toEqual(data[3]!.slice(0, 3));
  });

  it("owns buffers, accepts frozen inputs, and deterministically rebuilds edits", () => {
    const heights = [
      [0.1, -0.2],
      [0.3, -0.4],
    ];
    const original = createHeightfieldMeshAsset({ heights });
    const copy = createHeightfieldMeshAsset(
      Object.freeze({
        heights: Object.freeze(heights.map((row) => Object.freeze([...row]))),
      }),
    );
    expect(copy).toEqual(original);
    expect(copy.vertexStreams[0]!.data).not.toBe(
      original.vertexStreams[0]!.data,
    );
    heights[0]![0] = 9;
    expect(original).toEqual(copy);
    expect(vertices(createHeightfieldMeshAsset({ heights }))[0]![1]).toBe(9);
    const values = original.vertexStreams[0]!.data as Float32Array;
    values[1] = 42;
    expect(vertices(copy)[0]![1]).toBe(Math.fround(0.1));
  });

  it.each([2 ** -148, 1e-20, 1, 1e20, 3.4e38])(
    "supports finite uniform extents at %s without invalid normals",
    (extent) => {
      const mesh = createHeightfieldMeshAsset({
        ...flatHeightfield,
        width: extent,
        depth: extent,
      });
      expect(validateMeshAsset(mesh).valid).toBe(true);
      for (const vertex of vertices(mesh)) {
        expect(vertex.every(Number.isFinite)).toBe(true);
        expect(vertex.slice(3, 6)).toEqual([0, 1, 0]);
      }
    },
  );

  it.each(invalidHeightfields)(
    "rejects $name at $path",
    ({ options, path }) => {
      expect(() =>
        createHeightfieldMeshAsset(options as HeightfieldMeshOptions),
      ).toThrow(
        expect.objectContaining({
          name: "HeightfieldMeshError",
          path,
          message: expect.stringContaining(path),
        }),
      );
      expect(() =>
        createHeightfieldMeshAsset(options as HeightfieldMeshOptions),
      ).toThrow(HeightfieldMeshError);
    },
  );

  it("keeps coordinate-collapse diagnostics actionable and doesn't mask accessors", () => {
    expect(() =>
      createHeightfieldMeshAsset({
        heights: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        width: 2 ** -148,
      }),
    ).toThrow("width collapses columns 1 and 2 after float32 conversion");
    const failure = new Error("Authored grid accessor failed");
    expect(() =>
      createHeightfieldMeshAsset({
        get heights(): readonly (readonly number[])[] {
          throw failure;
        },
      }),
    ).toThrow(failure);
  });

  it.each(
    Array.from({ length: 24 }, (_, index) => ({
      rows: 2 + (index % 6),
      columns: 2 + (index % 8),
    })),
  )(
    "preserves geometry properties for $rows rows × $columns columns",
    ({ rows, columns }) => {
      const width = columns * 0.375;
      const depth = rows * 1.125;
      const heights = Array.from({ length: rows }, (_, row) =>
        Array.from(
          { length: columns },
          (_, column) => Math.sin(row * 1.7 + column * 0.9) * 2 + row / 8,
        ),
      );
      const mesh = createHeightfieldMeshAsset({ heights, width, depth });
      const data = vertices(mesh);
      expect(data).toHaveLength(6 * (rows - 1) * (columns - 1));
      expect(validateMeshAsset(mesh).valid).toBe(true);
      const edges = new Map<string, number>();
      const unique = new Set<string>();
      for (let offset = 0; offset < data.length; offset += 3) {
        const triangle = data.slice(offset, offset + 3);
        const normal = cross(triangle[0]!, triangle[1]!, triangle[2]!);
        expect(normal[1]).toBeGreaterThan(0);
        const length = Math.hypot(...normal);
        const keys = triangle.map((vertex) => vertex.slice(0, 3).join(","));
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = triangle[corner]!;
          unique.add(keys[corner]!);
          const edge = [keys[corner]!, keys[(corner + 1) % 3]!]
            .sort()
            .join("|");
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
          expect(Math.hypot(...vertex.slice(3, 6))).toBeCloseTo(1, 6);
          for (let axis = 0; axis < 3; axis += 1) {
            expect(vertex[axis + 3]).toBeCloseTo(normal[axis]! / length, 6);
            expect(vertex[axis]).toBeGreaterThanOrEqual(
              mesh.localAabb!.min[axis]!,
            );
            expect(vertex[axis]).toBeLessThanOrEqual(
              mesh.localAabb!.max[axis]!,
            );
          }
          expect(
            Math.hypot(
              ...vertex
                .slice(0, 3)
                .map((value, axis) => value - mesh.localSphere!.center[axis]!),
            ),
          ).toBeLessThanOrEqual(mesh.localSphere!.radius + 1e-12);
          const column = Math.round(vertex[6]! * (columns - 1));
          const row = Math.round(vertex[7]! * (rows - 1));
          expect(vertex[1]).toBe(Math.fround(heights[row]![column]!));
          expect(vertex[6]).toBe(Math.fround(column / (columns - 1)));
          expect(vertex[7]).toBe(Math.fround(row / (rows - 1)));
        }
      }
      expect(unique.size).toBe(rows * columns);
      expect(
        [...edges.values()].every((uses) => uses === 1 || uses === 2),
      ).toBe(true);
      expect([...edges.values()].filter((uses) => uses === 1)).toHaveLength(
        2 * (rows - 1) + 2 * (columns - 1),
      );
      expect(unique.size - edges.size + data.length / 3).toBe(1);
    },
  );
});
