import { describe, expect, it } from "vitest";
import { createPolygonMeshAsset } from "@aperture-engine/render";
import {
  roofCapTileBatches,
  roofFaceTileBatches,
  type RoofFaceTileOptions,
  type RoofPoint,
  type RoofTilePiece,
} from "../../examples/planar-reflections/src/roof.ts";

const options: RoofFaceTileOptions = {
  seed: 37,
  tile: { width: 0.3, length: 0.5, thickness: 0.025, overlap: 0.1 },
  face: {
    origin: [0, 1, 0],
    across: [1, 0, 0],
    uphill: [0, 0.6, -0.8],
    boundary: [
      [-0.9, 0],
      [0.9, 0],
      [0, 1.3],
    ],
  },
};

describe("public barrel roof recipe", () => {
  it("replays deterministically, accepts either boundary winding, and varies only material grouping", () => {
    const a = roofFaceTileBatches(options);
    expect(a).toEqual(roofFaceTileBatches(options));
    expect(a).toEqual(roofFaceTileBatches({ ...options, columnOffset: 0 }));
    expect(a).toEqual(
      roofFaceTileBatches({
        ...options,
        face: {
          ...options.face,
          boundary: [...options.face.boundary].reverse(),
        },
      }),
    );
    const b = roofFaceTileBatches({ ...options, seed: 38 });
    expect(b).not.toEqual(a);
    const byCell = (batches: typeof a) =>
      batches
        .flatMap((batch) => batch.pieces)
        .sort((p, q) => p.course - q.course || p.column - q.column);
    expect(byCell(a)).toEqual(byCell(b));
  });

  it("moves column zero by positive or negative across-distance without moving the boundary", () => {
    for (const columnOffset of [-0.17, 0.17]) {
      const batches = roofFaceTileBatches({ ...options, columnOffset });
      expect(batches).toEqual(
        roofFaceTileBatches({ ...options, columnOffset }),
      );
      const first = batches
        .flatMap((b) => b.pieces)
        .find((p) => p.column === 0 && p.course === 0)!;
      const lipX = first.faces[0]!.outline.map((p) => p[0]);
      expect((Math.max(...lipX) + Math.min(...lipX)) / 2).toBeCloseTo(
        columnOffset,
        8,
      );
      for (const batch of batches)
        for (const piece of batch.pieces) {
          checkClosedOutward(piece);
          for (const { outline } of piece.faces)
            for (const p of outline) {
              const uphill = dot(
                sub(p, options.face.origin),
                options.face.uphill,
              );
              expect(Math.abs(p[0])).toBeLessThanOrEqual(
                0.9 * (1 - uphill / 1.3) + 1e-7,
              );
            }
        }
    }
  });

  it("fits two rectangular verges below the trim for different spans and slopes", () => {
    for (const [span, slope, direction] of [
      [1.8, [0, 0.6, -0.8], 1],
      [2.31, [0, 1.25, 1.74], -1],
    ] as const) {
      const slopeLength = Math.hypot(...slope);
      const uphill: RoofPoint = slope.map(
        (v) => v / slopeLength,
      ) as unknown as RoofPoint;
      const across: RoofPoint = [direction, 0, 0];
      const normal = cross(across, uphill);
      const origin: RoofPoint = [1.3, 2.1, -0.7];
      const xMin = -span / 2,
        xMax = span / 2;
      const columnPitch = span / Math.ceil(span / options.tile.width);
      const cutHeights: number[] = [];
      for (const columnOffset of [0, xMin + columnPitch / 2]) {
        const batches = roofFaceTileBatches({
          ...options,
          columnPitch,
          columnOffset,
          face: {
            origin,
            across,
            uphill,
            boundary: [
              [xMin, 0],
              [xMax, 0],
              [xMax, 1.3],
              [xMin, 1.3],
            ],
          },
        });
        const heights: number[] = [];
        const touched = new Set<number>();
        for (const batch of batches) {
          if (batch.mesh.kind !== "polygons")
            throw new Error("Expected polygons");
          const asset = createPolygonMeshAsset(batch.mesh.options);
          const stream = asset.vertexStreams.find((s) =>
            s.attributes.some((a) => a.semantic === "POSITION"),
          )!;
          const offset =
            stream.attributes.find((a) => a.semantic === "POSITION")!.offset /
            4;
          const stride = stream.arrayStride / 4;
          for (let i = offset; i < stream.data.length; i += stride) {
            const p: RoofPoint = [
              stream.data[i]!,
              stream.data[i + 1]!,
              stream.data[i + 2]!,
            ];
            const relative = sub(p, origin),
              x = dot(relative, across),
              y = dot(relative, uphill);
            expect(x).toBeGreaterThanOrEqual(xMin - 1e-6);
            expect(x).toBeLessThanOrEqual(xMax + 1e-6);
            expect(y).toBeGreaterThanOrEqual(-1e-6);
            expect(y).toBeLessThanOrEqual(1.3 + 1e-6);
            for (const edge of [xMin, xMax])
              if (Math.abs(x - edge) < 1e-6) {
                touched.add(edge);
                heights.push(dot(relative, normal));
              }
          }
        }
        expect(touched.size).toBe(2);
        cutHeights.push(Math.max(...heights));
      }
      // The same bed-centered trim misses crown cuts but covers aligned valley cuts.
      const trimRadius = 0.095;
      expect(cutHeights[0]).toBeGreaterThan(trimRadius);
      expect(cutHeights[1]).toBeLessThan(trimRadius);
    }
  });

  it("closes slanted hip cuts with outward Float32 triangles, including narrow tips", () => {
    for (const halfWidth of [0.9, 0.15003]) {
      const input: RoofFaceTileOptions = {
        ...options,
        face: {
          ...options.face,
          boundary: [
            [-halfWidth, 0],
            [halfWidth, 0],
            [0, 1.3],
          ],
        },
      };
      const batches = roofFaceTileBatches(input);
      expect(batches.length).toBeGreaterThan(0);
      for (const batch of batches)
        for (const piece of batch.pieces) {
          checkClosedOutward(piece);
          for (const face of piece.faces)
            for (const p of face.outline) {
              const x = p[0],
                y = dot(sub(p, input.face.origin), input.face.uphill);
              expect(y).toBeGreaterThanOrEqual(-1e-7);
              expect(y).toBeLessThanOrEqual(1.3 + 1e-7);
              expect(Math.abs(x)).toBeLessThanOrEqual(
                halfWidth * (1 - y / 1.3) + 1e-7,
              );
            }
        }
    }
  });

  it("fits forward and reversed cap runs exactly to their supplied endpoints", () => {
    for (const reverse of [false, true]) {
      const start: RoofPoint = reverse ? [1.2, 2, 0.3] : [-0.8, 1, 0];
      const end: RoofPoint = reverse ? [-0.8, 1, 0] : [1.2, 2, 0.3];
      const axis = sub(end, start),
        length = Math.hypot(...axis);
      const values: number[] = [];
      for (const batch of roofCapTileBatches({
        seed: 4,
        tile: options.tile,
        start,
        end,
        up: [0, 1, 0],
      }))
        for (const piece of batch.pieces) {
          checkClosedOutward(piece);
          for (const face of piece.faces)
            for (const p of face.outline)
              values.push(dot(sub(p, start), axis) / length);
        }
      expect(Math.min(...values)).toBeCloseTo(0, 6);
      expect(Math.max(...values)).toBeCloseTo(length, 6);
    }
  });

  it("emits actual lap lift above shell thickness and bounds large material chunks", () => {
    const batches = roofFaceTileBatches({
      ...options,
      materialCount: 1,
      face: {
        origin: [0, 0, 0],
        across: [1, 0, 0],
        uphill: [0, 1, 0],
        boundary: [
          [-3, 0],
          [3, 0],
          [3, 3],
          [-3, 3],
        ],
      },
    });
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.mesh.kind).toBe("polygons");
      if (batch.mesh.kind !== "polygons")
        throw new Error("Expected polygon descriptor");
      expect(batch.mesh.options.faces.length).toBeLessThanOrEqual(4096);
      expect(
        batch.mesh.options.faces.reduce((n, f) => n + f.outline.length, 0),
      ).toBeLessThanOrEqual(65536);
      const polygonOptions = batch.mesh.options;
      expect(() => createPolygonMeshAsset(polygonOptions)).not.toThrow();
    }
    const pieces = batches
      .flatMap((b) => b.pieces)
      .filter((p) => p.column === 0);
    const lower = pieces.find((p) => p.course === 0)!;
    const upper = pieces.find((p) => p.course === 1)!;
    const lip = lower.faces[0]!.outline[0]!;
    const tail = lower.faces[1]!.outline.at(-1)!;
    const coveringLip = upper.faces[0]!.outline[0]!;
    const at = (coveringLip[1] - lip[1]) / (tail[1] - lip[1]);
    const lowerAtLap = lip[2] + (tail[2] - lip[2]) * at;
    expect(coveringLip[2] - lowerAtLap).toBeGreaterThan(
      options.tile.thickness * 1.05,
    );
    expect(Math.abs(tail[0])).toBeLessThan(Math.abs(lip[0]));
  });

  it("rejects coplanar laps, invalid frames, collapsed coordinates and excessive work", () => {
    for (const columnOffset of [NaN, Infinity, -Infinity, 1e40])
      expect(() => roofFaceTileBatches({ ...options, columnOffset })).toThrow(
        /columnOffset/,
      );
    expect(() =>
      roofFaceTileBatches({ ...options, columnOffset: 1e20 }),
    ).toThrow(/safe column indices/);
    expect(() =>
      roofFaceTileBatches({
        ...options,
        tile: { ...options.tile, lipRise: 0.02 },
      }),
    ).toThrow(/coplanar/);
    expect(() =>
      roofFaceTileBatches({
        ...options,
        tile: { ...options.tile, overlap: 0 },
      }),
    ).toThrow(/overlap/);
    expect(() => roofFaceTileBatches({ ...options, seed: NaN })).toThrow(
      /seed/,
    );
    expect(() =>
      roofFaceTileBatches({
        ...options,
        face: { ...options.face, uphill: [1, 0, 0] },
      }),
    ).toThrow(/perpendicular/);
    expect(() =>
      roofFaceTileBatches({
        ...options,
        face: { ...options.face, origin: [1e20, 1e20, 1e20] },
      }),
    ).toThrow(/float32/);
    expect(() =>
      roofFaceTileBatches({
        ...options,
        face: {
          ...options.face,
          boundary: [
            [0, 0],
            [2, 0],
            [1, 0.2],
            [2, 2],
            [0, 2],
          ],
        },
      }),
    ).toThrow(/convex/);
    expect(() =>
      roofFaceTileBatches({
        ...options,
        face: {
          ...options.face,
          boundary: [
            [-100, 0],
            [100, 0],
            [0, 100],
          ],
        },
      }),
    ).toThrow(/20000/);
    expect(() =>
      roofCapTileBatches({
        seed: 1,
        tile: options.tile,
        start: [0, 0, 0],
        end: [0, 1, 0],
        up: [0, 1, 0],
      }),
    ).toThrow(/length/);
  });
});

type Triangle = readonly [RoofPoint, RoofPoint, RoofPoint];
function sub(a: RoofPoint, b: RoofPoint): RoofPoint {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: RoofPoint, b: RoofPoint): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: RoofPoint, b: RoofPoint): RoofPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function inside(point: RoofPoint, triangles: readonly Triangle[]): boolean {
  const ray: RoofPoint = [0.317, 0.619, 1],
    hits: number[] = [];
  for (const [a, b, c] of triangles) {
    const e1 = sub(b, a),
      e2 = sub(c, a),
      p = cross(ray, e2),
      det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const t = sub(point, a),
      u = dot(t, p) / det,
      q = cross(t, e1),
      v = dot(ray, q) / det,
      distance = dot(e2, q) / det;
    if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9 && distance > 1e-9)
      hits.push(distance);
  }
  hits.sort((a, b) => a - b);
  return (
    hits.filter((v, i) => i === 0 || v - hits[i - 1]! > 1e-7).length % 2 === 1
  );
}

function checkClosedOutward(piece: RoofTilePiece): void {
  const asset = createPolygonMeshAsset({ faces: piece.faces });
  const stream = asset.vertexStreams.find((s) =>
    s.attributes.some((a) => a.semantic === "POSITION"),
  )!;
  const offset =
      stream.attributes.find((a) => a.semantic === "POSITION")!.offset / 4,
    stride = stream.arrayStride / 4;
  const position = (index: number): RoofPoint => [
    stream.data[index * stride + offset]!,
    stream.data[index * stride + offset + 1]!,
    stream.data[index * stride + offset + 2]!,
  ];
  const indices = asset.indexBuffer!.data;
  const triangles: Triangle[] = Array.from(
    { length: indices.length / 3 },
    (_, i) => [
      position(indices[i * 3]!),
      position(indices[i * 3 + 1]!),
      position(indices[i * 3 + 2]!),
    ],
  );
  const edges = new Map<string, number>(),
    origin = triangles[0]![0];
  let volume = 0;
  for (const [a, b, c] of triangles) {
    expect([a, b, c].flat().every(Number.isFinite)).toBe(true);
    const normal = cross(sub(b, a), sub(c, a)),
      area = Math.hypot(...normal);
    expect(area).toBeGreaterThan(0);
    volume += dot(sub(a, origin), cross(sub(b, origin), sub(c, origin))) / 6;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = `${p.join(",")}|${q.join(",")}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const epsilon = Math.min(2e-6, Math.sqrt(area) * 1e-3);
    const displaced = (sign: number): RoofPoint =>
      [0, 1, 2].map(
        (i) =>
          (a[i]! + b[i]! + c[i]!) / 3 + (normal[i]! / area) * epsilon * sign,
      ) as unknown as RoofPoint;
    expect(inside(displaced(1), triangles)).toBe(false);
    expect(inside(displaced(-1), triangles)).toBe(true);
  }
  for (const [edge, count] of edges) {
    expect(count).toBe(1);
    expect(edges.get(edge.split("|").reverse().join("|"))).toBe(1);
  }
  expect(volume).toBeGreaterThan(0);
}
