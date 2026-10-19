import { describe, expect, it } from "vitest";
import { createPolygonMeshAsset } from "@aperture-engine/render";
import {
  roofEnvelope,
  type RoofEnvelopeOptions,
  type RoofEnvelopeSolid,
} from "../../examples/planar-reflections/src/roof-envelope.ts";
import {
  roofFaceTileBatches,
  type RoofPoint,
} from "../../examples/planar-reflections/src/roof.ts";

const symmetric: RoofEnvelopeOptions = {
  roofX: [-2.7, 2.7],
  wallX: [-2.4, 2.4],
  wallZ: [-1.5, 1.5],
  profile: [
    [-1.8, 2.2],
    [0, 3.5],
    [1.8, 2.2],
  ],
  baseY: 0,
  thickness: 0.14,
};
const asymmetric: RoofEnvelopeOptions = {
  roofX: [-3, 2.4],
  wallX: [-2.7, 2.2],
  wallZ: [-1.8, 1.6],
  profile: [
    [-2.2, 2.1],
    [0.35, 3.8],
    [1.9, 2.5],
  ],
  baseY: 0,
  thickness: 0.12,
};
const cases: Record<string, RoofEnvelopeOptions> = {
  symmetric,
  asymmetric,
  width: { ...symmetric, roofX: [-3.24, 3.24], wallX: [-2.88, 2.88] },
  depth: {
    ...symmetric,
    wallZ: [-1.8, 1.8],
    profile: [
      [-2.16, 2.2],
      [0, 3.5],
      [2.16, 2.2],
    ],
  },
  rise: {
    ...symmetric,
    profile: [
      [-1.8, 2.2],
      [0, 4.1],
      [1.8, 2.2],
    ],
  },
  small: {
    roofX: [-0.27, 0.27],
    wallX: [-0.24, 0.24],
    wallZ: [-0.15, 0.15],
    profile: [
      [-0.18, 0.22],
      [0, 0.35],
      [0.18, 0.22],
    ],
    baseY: 0,
    thickness: 0.014,
  },
  steep: {
    ...symmetric,
    profile: [
      [-1.8, 2.2],
      [0, 7],
      [1.8, 2.2],
    ],
  },
  translated: {
    roofX: [-2, 3.4],
    wallX: [-1.7, 3.1],
    wallZ: [-1.9, 1.1],
    profile: [
      [-2.2, 3.4],
      [-0.4, 4.7],
      [1.4, 3.4],
    ],
    baseY: 1.2,
    thickness: 0.14,
  },
};
const sub = (a: RoofPoint, b: RoofPoint): RoofPoint => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const cross = (a: RoofPoint, b: RoofPoint): RoofPoint => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: RoofPoint, b: RoofPoint): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Independent scalar profile and volume oracle; never uses returned landmarks. */
function expected(options: RoofEnvelopeOptions) {
  const [b, r, f] = options.profile;
  const top = (z: number): number => {
    const slope =
      z <= r[0] ? (r[1] - b[1]) / (r[0] - b[0]) : (f[1] - r[1]) / (f[0] - r[0]);
    return r[1] + slope * (z - r[0]);
  };
  const height = (z: number): number =>
    top(z) - options.thickness - options.baseY;
  return {
    top,
    roof:
      (options.roofX[1] - options.roofX[0]) * (f[0] - b[0]) * options.thickness,
    wall:
      (options.wallX[1] - options.wallX[0]) *
      (((r[0] - options.wallZ[0]) * (height(options.wallZ[0]) + height(r[0]))) /
        2 +
        ((options.wallZ[1] - r[0]) *
          (height(options.wallZ[1]) + height(r[0]))) /
          2),
  };
}

function decoded(solid: RoofEnvelopeSolid): RoofPoint[][] {
  if (solid.mesh.kind !== "polygons") throw new Error("Expected polygons");
  const asset = createPolygonMeshAsset(solid.mesh.options);
  const stream = asset.vertexStreams.find((s) =>
    s.attributes.some((a) => a.semantic === "POSITION"),
  )!;
  const stride = stream.arrayStride / 4,
    offset =
      stream.attributes.find((a) => a.semantic === "POSITION")!.offset / 4;
  const p = (index: number): RoofPoint => [
    stream.data[index * stride + offset]!,
    stream.data[index * stride + offset + 1]!,
    stream.data[index * stride + offset + 2]!,
  ];
  const indices = asset.indexBuffer!.data;
  return Array.from({ length: indices.length / 3 }, (_, i) => [
    p(indices[i * 3]!),
    p(indices[i * 3 + 1]!),
    p(indices[i * 3 + 2]!),
  ]);
}

function closedVolume(triangles: readonly (readonly RoofPoint[])[]): number {
  const edges = new Map<string, number>();
  const origin = triangles[0]![0]!;
  let volume = 0;
  for (const triangle of triangles) {
    const [a, b, c] = triangle as readonly [RoofPoint, RoofPoint, RoofPoint];
    expect([...a, ...b, ...c].every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...cross(sub(b, a), sub(c, a)))).toBeGreaterThan(1e-12);
    volume += dot(sub(a, origin), cross(sub(b, origin), sub(c, origin))) / 6;
    for (let i = 0; i < 3; i++) {
      const key = JSON.stringify([triangle[i], triangle[(i + 1) % 3]]);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of edges) {
    const [a, b] = JSON.parse(key) as [RoofPoint, RoofPoint];
    expect(count).toBe(1);
    expect(edges.get(JSON.stringify([b, a]))).toBe(1);
  }
  return volume;
}

describe("shared closed roof envelope recipe", () => {
  it.each(Object.entries(cases))(
    "preserves fitted contact and analytic Float32 volumes for %s",
    (_, options) => {
      const result = roofEnvelope(options),
        oracle = expected(options);
      for (const part of ["roof", "wall"] as const) {
        const actual = closedVolume(decoded(result[part]));
        expect(Math.abs(actual - oracle[part])).toBeLessThanOrEqual(
          64 * 2 ** -23 * Math.max(1, oracle[part]),
        );
      }
      for (const face of result.wall.faces.filter((f) =>
        f.name.endsWith("-top"),
      ))
        for (const p of face.outline)
          expect(p[1]).toBeCloseTo(oracle.top(p[2]) - options.thickness, 10);
      for (const face of result.roof.faces.filter((f) =>
        f.name.endsWith("-underside"),
      ))
        for (const p of face.outline)
          expect(p[1]).toBeCloseTo(oracle.top(p[2]) - options.thickness, 10);
      for (const [side, frame] of Object.entries(result.tileFaces)) {
        const slope =
          side === "back"
            ? (options.profile[1][1] - options.profile[0][1]) /
              (options.profile[1][0] - options.profile[0][0])
            : (options.profile[2][1] - options.profile[1][1]) /
              (options.profile[2][0] - options.profile[1][0]);
        expect(
          dot(cross(frame.across, frame.uphill), [0, 1, -slope]),
        ).toBeGreaterThan(0);
        for (const [u, v] of frame.boundary) {
          const p = frame.origin.map(
            (n, i) => n + u * frame.across[i]! + v * frame.uphill[i]!,
          ) as unknown as RoofPoint;
          expect(p[1]).toBeCloseTo(oracle.top(p[2]), 10);
          expect(options.roofX.some((x) => Math.abs(x - p[0]) < 1e-10)).toBe(
            true,
          );
        }
      }
    },
  );

  it("feeds both outward frames to the existing tile recipe without a transform bridge", () => {
    const result = roofEnvelope(asymmetric);
    for (const face of Object.values(result.tileFaces)) {
      const width = (asymmetric.roofX[1] - asymmetric.roofX[0]) / 20;
      const batches = roofFaceTileBatches({
        face,
        seed: 37,
        tile: {
          width,
          length: width * 1.6,
          thickness: width * 0.08,
          overlap: width * 0.32,
        },
      });
      expect(batches.length).toBeGreaterThan(0);
      for (const batch of batches) {
        if (batch.mesh.kind !== "polygons")
          throw new Error("Expected polygons");
        const options = batch.mesh.options;
        expect(() => createPolygonMeshAsset(options)).not.toThrow();
      }
    }
  });

  it.each([
    { pitchDegrees: 30 },
    {
      profile: [
        [0, 1],
        [0, 2],
        [1, 1],
      ],
    },
    {
      profile: [
        [0, 1],
        [1, 2],
      ],
    },
    {
      profile: [
        [-1.8, 2.2],
        [0, Infinity],
        [1.8, 2.2],
      ],
    },
    { roofX: [2.7, -2.7] },
    { wallX: [-3, 2.4] },
    { wallZ: [-2, 1.5] },
    { wallZ: [0.2, 1.5] },
    {
      profile: [
        [-1.8, 2.2],
        [0, 2.2],
        [1.8, 2.2],
      ],
    },
    { thickness: 0 },
    { thickness: -0.1 },
    { thickness: 1e-12 },
    { roofX: [1e8, 1e8 + 5.4] },
    { baseY: 3.5 },
    { roofX: new Array(2) },
    { wallZ: new Array(2) },
    { profile: [new Array(2), [0, 3.5], [1.8, 2.2]] },
    { profile: new Array(3) },
  ])("rejects conflicting, unsupported or collapsed input %j", (patch) => {
    expect(() =>
      roofEnvelope({
        ...symmetric,
        ...patch,
      } as unknown as RoofEnvelopeOptions),
    ).toThrow(RangeError);
  });
});
