import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createLatheMeshAsset,
  createTriangleListMeshAsset,
  createMeshGpuUploadPlan,
  createSpatialTriangleMeshFromMeshAsset,
  LatheMeshError,
  validateMeshAsset,
  type LatheMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { invalidLathes, openLathe, thickBowl } from "../helpers/lathe-cases.js";

function vertices(mesh: MeshAsset): number[][] {
  const stream = mesh.vertexStreams[0]!;
  return Array.from({ length: stream.vertexCount }, (_, i) =>
    Array.from(stream.data.slice(i * 8, i * 8 + 8)),
  );
}
function cross(a: number[], b: number[], c: number[]): number[] {
  const ab = b.slice(0, 3).map((v, i) => v - a[i]!);
  const ac = c.slice(0, 3).map((v, i) => v - a[i]!);
  return [
    ab[1]! * ac[2]! - ab[2]! * ac[1]!,
    ab[2]! * ac[0]! - ab[0]! * ac[2]!,
    ab[0]! * ac[1]! - ab[1]! * ac[0]!,
  ];
}

describe("lathe meshes", () => {
  it("exposes typed options, defaults, layout, and the specified first quad winding", () => {
    expectTypeOf(createLatheMeshAsset)
      .parameter(0)
      .toEqualTypeOf<LatheMeshOptions>();
    const defaults = createLatheMeshAsset(openLathe);
    expect(defaults.label).toBe("Lathe");
    expect(defaults.vertexStreams[0]!.vertexCount).toBe(32 * 6);
    const mesh = createLatheMeshAsset({
      ...openLathe,
      radialSegments: 4,
      label: "Column",
    });
    expect(mesh.label).toBe("Column");
    expect(mesh.indexBuffer).toBeUndefined();
    expect(mesh.vertexStreams[0]).toMatchObject({
      arrayStride: 32,
      vertexCount: 24,
    });
    const points = vertices(mesh);
    expect(points.slice(0, 6).map((v) => v.slice(6))).toEqual([
      [0, 0],
      [0, 1],
      [0.25, 0],
      [0.25, 0],
      [0, 1],
      [0.25, 1],
    ]);
    expect(points[0]!.slice(0, 3)).toEqual([1, 0, 0]);
    expect(points[1]!.slice(0, 3)).toEqual([1, 1, 0]);
    expect(points[2]![2]).toBe(1);
    expect(points[0]![3]).toBeGreaterThan(0);
    expect(points[0]![5]).toBeGreaterThan(0);
    expect(mesh.localAabb).toEqual({ min: [-1, 0, -1], max: [1, 1, 1] });
    expect(validateMeshAsset(mesh)).toEqual({ valid: true, diagnostics: [] });
    expect(createMeshGpuUploadPlan(mesh)).toMatchObject({
      valid: true,
      diagnostics: [],
    });
    expect(createSpatialTriangleMeshFromMeshAsset(mesh)).toMatchObject({
      diagnostics: [],
    });
  });
  it.each([3, 4, 7, 32, 128])(
    "copies the seam exactly with distinct UVs at %i segments",
    (radialSegments) => {
      const data = vertices(
        createLatheMeshAsset({ ...openLathe, radialSegments }),
      );
      for (const v of [0, 1]) {
        const start = data.filter((p) => p[6] === 0 && p[7] === v);
        const end = data.filter((p) => p[6] === 1 && p[7] === v);
        expect(start.length).toBeGreaterThan(0);
        expect(end.length).toBeGreaterThan(0);
        for (const p of end)
          expect(p.slice(0, 3)).toEqual(start[0]!.slice(0, 3));
      }
      for (const p of data) {
        expect(p[6]).toBeGreaterThanOrEqual(0);
        expect(p[6]).toBeLessThanOrEqual(1);
      }
    },
  );
  it("orients a thick bowl's underside, outside, rim, inside, and floor correctly", () => {
    const mesh = createLatheMeshAsset(thickBowl);
    const data = vertices(mesh);
    expect(data).toHaveLength(12 * 8 * 3);
    const trianglesPerEdge = [12, 24, 24, 24, 12];
    let start = 0;
    for (let edge = 0; edge < 5; edge++) {
      for (let t = 0; t < trianglesPerEdge[edge]!; t++) {
        const face = data.slice((start + t) * 3, (start + t + 1) * 3);
        const n = face[0]!.slice(3, 6);
        if (edge === 0) expect(n[1]).toBe(-1);
        if (edge === 2 || edge === 4) expect(n[1]).toBe(1);
        const center = [0, 1, 2].map(
          (axis) => face.reduce((s, p) => s + p[axis]!, 0) / 3,
        );
        const dot = n[0]! * center[0]! + n[2]! * center[2]!;
        if (edge === 1) expect(dot).toBeGreaterThan(0);
        if (edge === 3) expect(dot).toBeLessThan(0);
      }
      start += trianglesPerEdge[edge]!;
    }
    const poles = data.filter((p) => p[0] === 0 && p[2] === 0);
    expect(new Set(poles.map((p) => p[6])).size).toBeGreaterThan(1);
    expect(poles.every((p) => p[7] === 0 || p[7] === 1)).toBe(true);
  });
  it.each([
    openLathe,
    thickBowl,
    {
      profile: [
        [1, 0],
        [1, 1],
        [2, 1],
        [2, 0],
        [1, 0],
      ],
      radialSegments: 8,
    } satisfies LatheMeshOptions,
  ])(
    "keeps all generated normals finite, flat, unit, and consistent with winding and bounds",
    (options) => {
      const mesh = createLatheMeshAsset(options);
      const data = vertices(mesh);
      for (let i = 0; i < data.length; i += 3) {
        const a = data[i]!,
          b = data[i + 1]!,
          c = data[i + 2]!;
        const n = cross(a, b, c);
        const len = Math.hypot(...n);
        expect(len).toBeGreaterThan(0);
        expect(a.slice(3, 6)).toEqual(b.slice(3, 6));
        expect(a.slice(3, 6)).toEqual(c.slice(3, 6));
        expect(Math.hypot(...a.slice(3, 6))).toBeCloseTo(1, 6);
        for (let axis = 0; axis < 3; axis++)
          expect(a[axis + 3]).toBeCloseTo(n[axis]! / len, 6);
      }
      for (const p of data) {
        expect(p.every(Number.isFinite)).toBe(true);
        for (let axis = 0; axis < 3; axis++) {
          expect(p[axis]).toBeGreaterThanOrEqual(mesh.localAabb!.min[axis]!);
          expect(p[axis]).toBeLessThanOrEqual(mesh.localAabb!.max[axis]!);
        }
        expect(
          Math.hypot(
            ...p.slice(0, 3).map((v, i) => v - mesh.localSphere!.center[i]!),
          ),
        ).toBeLessThanOrEqual(mesh.localSphere!.radius + 1e-6);
      }
    },
  );
  it("reverses outer-wall and both pole orientations with profile order", () => {
    const profile: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 2],
      [0, 2],
    ];
    const data = vertices(
      createLatheMeshAsset({
        profile: [...profile].reverse(),
        radialSegments: 8,
      }),
    );
    for (let i = 0; i < data.length; i += 3) {
      const face = data.slice(i, i + 3);
      const center = [0, 1, 2].map(
        (axis) => face.reduce((sum, p) => sum + p[axis]!, 0) / 3,
      );
      const n = face[0]!.slice(3, 6);
      if (center[1] === 2) expect(n[1]).toBe(-1);
      else if (center[1] === 0) expect(n[1]).toBe(1);
      else expect(n[0]! * center[0]! + n[2]! * center[2]!).toBeLessThan(0);
    }
  });

  it("matches explicitly authored triangle lists for varied finite profiles", () => {
    for (let sample = 0; sample < 12; sample++) {
      const count = 3 + sample;
      const profile: [number, number][] = Array.from({ length: 5 }, (_, i) => [
        Math.fround(1 + Math.sin(i * 2 + sample) * 0.4),
        Math.fround(i * 0.37 - 1),
      ]);
      const positions: [number, number, number][] = [];
      const uvs: [number, number][] = [];
      const indices: number[] = [];
      profile.forEach(([r, y], i) => {
        for (let j = 0; j <= count; j++) {
          const angle = (j / count) * Math.PI * 2;
          positions.push(
            j === count || j === 0
              ? [r, y, 0]
              : [r * Math.cos(angle), y, r * Math.sin(angle)],
          );
          uvs.push([j / count, i / 4]);
        }
      });
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < count; j++) {
          const a = i * (count + 1) + j,
            b = a + count + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      expect(createLatheMeshAsset({ profile, radialSegments: count })).toEqual(
        createTriangleListMeshAsset({
          label: "Lathe",
          positions,
          uvs,
          indices,
        }),
      );
    }
  });

  it("accepts deeply frozen profile arrays without modifying them", () => {
    const profile = Object.freeze([
      Object.freeze([1, -1] as const),
      Object.freeze([0, 1] as const),
    ]);
    expect(() =>
      createLatheMeshAsset(Object.freeze({ profile, radialSegments: 3 })),
    ).not.toThrow();
  });

  it("leaves positive endpoints open and closes a profile only when explicitly repeated", () => {
    expect(
      createLatheMeshAsset({ ...openLathe, radialSegments: 8 })
        .vertexStreams[0]!.vertexCount,
    ).toBe(48);
    const profile: [number, number][] = [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 0],
    ];
    expect(
      createLatheMeshAsset({ profile, radialSegments: 8 }).vertexStreams[0]!
        .vertexCount,
    ).toBe(3 * 48);
    expect(
      createLatheMeshAsset({
        profile: [...profile, profile[0]!],
        radialSegments: 8,
      }).vertexStreams[0]!.vertexCount,
    ).toBe(4 * 48);
  });
  it("owns deterministic buffers independently of mutable inputs and later assets", () => {
    const profile: [number, number][] = [
      [1, 0],
      [1, 2],
    ];
    const options = { profile };
    const a = createLatheMeshAsset(options);
    const b = createLatheMeshAsset(options);
    expect(a).toEqual(b);
    expect(a.vertexStreams[0]!.data.buffer).not.toBe(
      b.vertexStreams[0]!.data.buffer,
    );
    profile[0]![0] = 2;
    expect(a).toEqual(b);
    a.vertexStreams[0]!.data[0] = 99;
    expect(b.vertexStreams[0]!.data[0]).toBe(1);
  });
  it("accepts small valid geometry without an arbitrary area cutoff", () => {
    expect(
      validateMeshAsset(
        createLatheMeshAsset({
          profile: [
            [1e-20, 0],
            [1e-20, 1e-20],
          ],
          radialSegments: 3,
        }),
      ).valid,
    ).toBe(true);
  });
  it.each(invalidLathes)(
    "rejects $name with an actionable path",
    ({ options, path }) => {
      expect(() => createLatheMeshAsset(options as LatheMeshOptions)).toThrow(
        expect.objectContaining({ name: "LatheMeshError", path }),
      );
    },
  );
  it("preserves exceptions from authored accessors", () => {
    const failure = new Error("profile getter");
    expect(() =>
      createLatheMeshAsset({
        get profile(): LatheMeshOptions["profile"] {
          throw failure;
        },
      }),
    ).toThrow(failure);
    expect(new LatheMeshError("profile", "must contain points")).toBeInstanceOf(
      RangeError,
    );
  });
});
