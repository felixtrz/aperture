import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  createRoundedBoxMeshAsset,
  RoundedBoxMeshError,
  validateMeshAsset,
  validateRoundedBoxMeshOptions,
  type MeshAsset,
  type RoundedBoxMeshOptions,
} from "@aperture-engine/render";

function read(asset: MeshAsset) {
  const stream = asset.vertexStreams[0]!;
  const data = stream.data as Float32Array;
  return {
    points: Array.from({ length: stream.vertexCount }, (_, index) =>
      Array.from(data.slice(index * 8, index * 8 + 3)),
    ),
    normals: Array.from({ length: stream.vertexCount }, (_, index) =>
      Array.from(data.slice(index * 8 + 3, index * 8 + 6)),
    ),
    uvs: Array.from({ length: stream.vertexCount }, (_, index) =>
      Array.from(data.slice(index * 8 + 6, index * 8 + 8)),
    ),
    indices: Array.from(asset.indexBuffer!.data),
  };
}

function cross(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
) {
  const ab = a.map((value, axis) => b[axis]! - value);
  const ac = a.map((value, axis) => c[axis]! - value);
  return [
    ab[1]! * ac[2]! - ab[2]! * ac[1]!,
    ab[2]! * ac[0]! - ab[0]! * ac[2]!,
    ab[0]! * ac[1]! - ab[1]! * ac[0]!,
  ];
}

describe("indexed rounded-box geometry", () => {
  it("creates a bounded indexed mesh with supplied normal and UV attributes", () => {
    const asset = createRoundedBoxMeshAsset();
    expect(validateMeshAsset(asset)).toEqual({ valid: true, diagnostics: [] });
    expect(asset.label).toBe("Rounded box");
    expect(asset.indexBuffer!.data).toBeInstanceOf(Uint16Array);
    expect(asset.vertexStreams[0]!.vertexCount).toBe(384);
    expect(asset.indexBuffer!.data.length).toBe(1764);
    expect(
      asset.vertexStreams[0]!.attributes.map((entry) => entry.semantic),
    ).toEqual(["POSITION", "NORMAL", "TEXCOORD_0"]);
    expect(asset.submeshes).toHaveLength(1);
    expect(asset.submeshes[0]!.topology).toBe("triangle-list");
  });

  it("keeps requested extents, flat centers and a tight enclosing sphere", () => {
    const halfExtents = [2, 1, 0.6] as const;
    const asset = createRoundedBoxMeshAsset({
      halfExtents,
      radius: 0.2,
      bevelSegments: 4,
    });
    const { points, normals } = read(asset);
    for (let axis = 0; axis < 3; axis++) {
      expect(asset.localAabb!.min[axis]).toBeCloseTo(-halfExtents[axis]!, 6);
      expect(asset.localAabb!.max[axis]).toBeCloseTo(halfExtents[axis]!, 6);
      expect(
        points.some(
          (point, index) =>
            point[axis] === Math.fround(halfExtents[axis]!) &&
            normals[index]![axis] === 1,
        ),
      ).toBe(true);
    }
    for (const point of points) {
      expect(Math.hypot(...point)).toBeLessThanOrEqual(
        asset.localSphere!.radius,
      );
      for (let axis = 0; axis < 3; axis++) {
        expect(Math.abs(point[axis]!)).toBeLessThanOrEqual(
          Math.fround(halfExtents[axis]!),
        );
      }
    }
    expect(asset.localSphere!.center).toEqual([0, 0, 0]);
    expect(asset.localSphere!.radius).toBeLessThan(Math.hypot(...halfExtents));
  });

  it.each([
    { halfExtents: [2, 1, 0.6], radius: 0.2, bevelSegments: 1 },
    { halfExtents: [2, 1, 0.6], radius: 0.6, bevelSegments: 4 },
    { halfExtents: [0.5, 0.5, 0.5], radius: 0.5, bevelSegments: 3 },
  ] as const)(
    "is closed and outward with no collapsed center rows: %j",
    (options) => {
      const { points, normals, indices } = read(
        createRoundedBoxMeshAsset(options),
      );
      // UV seams deliberately duplicate vertices; topology is welded by exact
      // stored position, just as for the existing six-face box primitive.
      const welded = new Map<string, number>();
      const ids = points.map((point) => {
        const key = point.join(",");
        if (!welded.has(key)) welded.set(key, welded.size);
        return welded.get(key)!;
      });
      const edges = new Map<string, { count: number; orientation: number }>();
      for (let index = 0; index < indices.length; index += 3) {
        const triangle = indices.slice(index, index + 3);
        const [a, b, c] = triangle.map((id) => points[id]!) as [
          number[],
          number[],
          number[],
        ];
        const normal = cross(a, b, c);
        expect(Math.hypot(...normal)).toBeGreaterThan(0);
        const center = a.map(
          (value, axis) => (value + b[axis]! + c[axis]!) / 3,
        );
        expect(
          normal.reduce((sum, value, axis) => sum + value * center[axis]!, 0),
        ).toBeGreaterThan(0);
        const supplied = triangle.map((id) => normals[id]!);
        expect(
          normal.reduce(
            (sum, value, axis) =>
              sum +
              value *
                supplied.reduce((total, entry) => total + entry[axis]!, 0),
            0,
          ),
        ).toBeGreaterThan(0);
        for (let corner = 0; corner < 3; corner++) {
          const from = ids[triangle[corner]!]!;
          const to = ids[triangle[(corner + 1) % 3]!]!;
          const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
          const edge = edges.get(key) ?? { count: 0, orientation: 0 };
          edge.count++;
          edge.orientation += from < to ? 1 : -1;
          edges.set(key, edge);
        }
      }
      expect(
        [...edges.values()].every(
          (edge) => edge.count === 2 && edge.orientation === 0,
        ),
      ).toBe(true);
      expect(welded.size - edges.size + indices.length / 3).toBe(2);
    },
  );

  it("supplies unit smooth corner normals and finite UVs with matching seam normals", () => {
    const options = {
      halfExtents: [2, 1, 0.6],
      radius: 0.2,
      bevelSegments: 4,
    } as const;
    const { points, normals, uvs } = read(createRoundedBoxMeshAsset(options));
    const seams = new Map<string, number[]>();
    let smoothCorners = 0;
    let uvSeams = 0;
    for (let index = 0; index < points.length; index++) {
      const point = points[index]!;
      const normal = normals[index]!;
      expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
      const offset = point.map((value, axis) => {
        const core = options.halfExtents[axis]! - options.radius;
        return value - Math.max(-core, Math.min(core, value));
      });
      expect(Math.hypot(...offset)).toBeCloseTo(options.radius, 6);
      if (normal.every((value) => Math.abs(value) > 0)) smoothCorners++;
      expect(
        uvs[index]!.every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ),
      ).toBe(true);
      const key = point.join(",");
      const prior = seams.get(key);
      if (prior !== undefined) {
        expect(normal).toEqual(normals[prior[0]!]!);
        if (uvs[index]!.join(",") !== uvs[prior[0]!]!.join(",")) uvSeams++;
        prior.push(index);
      } else seams.set(key, [index]);
    }
    expect(smoothCorners).toBeGreaterThan(0);
    expect(uvSeams).toBeGreaterThan(0);
  });

  it("delegates radius zero to the existing box byte-for-byte", () => {
    for (const label of [undefined, "Flat compatibility"]) {
      const shared = label === undefined ? {} : { label };
      expect(
        createRoundedBoxMeshAsset({
          ...shared,
          halfExtents: [0.1, 1, 2],
          radius: 0,
          bevelSegments: 32,
        }),
      ).toEqual(
        createBoxMeshAsset({ ...shared, width: 0.2, height: 2, depth: 4 }),
      );
    }
  });

  it("bounds maximum subdivision storage and rejects malformed parameters", () => {
    const maximum = createRoundedBoxMeshAsset({ bevelSegments: 32 });
    expect(maximum.vertexStreams[0]!.vertexCount).toBe(6 * 66 * 66);
    expect(
      Array.from(maximum.indexBuffer!.data).reduce(
        (maximum, value) => Math.max(maximum, value),
        0,
      ),
    ).toBeLessThan(65536);
    expect(
      maximum.vertexStreams[0]!.data.byteLength +
        maximum.indexBuffer!.data.byteLength,
    ).toBeLessThan(2_000_000);
    const invalid = [
      null,
      { halfExtents: null },
      { halfExtents: [1, 1] },
      { halfExtents: [1, 1, 1, 1] },
      ...[0, -1, Infinity, NaN, Number.MAX_VALUE, Number.MIN_VALUE, "1"].map(
        (value) => ({ halfExtents: [value, 1, 1] }),
      ),
      ...[-1, Infinity, NaN, 0.51, null, "0.1", Number.MIN_VALUE].map(
        (radius) => ({ radius }),
      ),
      ...[0, 33, 1.5, Infinity, NaN, null, "3"].map((bevelSegments) => ({
        bevelSegments,
        radius: 0,
      })),
    ];
    for (const input of invalid) {
      const options = input as unknown as RoundedBoxMeshOptions;
      expect(() => validateRoundedBoxMeshOptions(options)).toThrow(
        RoundedBoxMeshError,
      );
      expect(() => createRoundedBoxMeshAsset(options)).toThrow(
        RoundedBoxMeshError,
      );
    }
  });

  it("rejects bevels that collapse in float32 rather than emitting degenerate faces", () => {
    expect(() =>
      createRoundedBoxMeshAsset({
        halfExtents: [100_000_000, 100_000_000, 100_000_000],
        radius: 0.1,
      }),
    ).toThrow(/zero-area triangle after float32/);
  });
});
