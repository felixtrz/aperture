import { describe, expect, it } from "vitest";
import {
  createPolygonMeshAsset,
  validateMeshAsset,
  type PolygonMeshPoint,
} from "@aperture-engine/render";

// A clipped planar trapezoid. Rounding its corners to Float32 moves its
// least-planar corner just beyond the ordinary relative planarity tolerance.
const clipped: readonly PolygonMeshPoint[] = [
  [2.1050000000000004, 4.205224260382408, -1.6721650178268475],
  [2.1057045526222904, 4.215518003855974, -1.6899412726713368],
  [2.128094949138243, 4.206611498242559, -1.6745606374374675],
  [2.128, 4.205224260382408, -1.6721650178268475],
];

const subtract = (
  a: PolygonMeshPoint,
  b: PolygonMeshPoint,
): PolygonMeshPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: PolygonMeshPoint, b: PolygonMeshPoint): PolygonMeshPoint => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: PolygonMeshPoint, b: PolygonMeshPoint): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Establish that a positive regression cannot pass through the old tolerance.
function expectRoundingFallback(outline: readonly PolygonMeshPoint[]): void {
  const points = outline.map(
    (p): PolygonMeshPoint => [
      Math.fround(p[0]),
      Math.fround(p[1]),
      Math.fround(p[2]),
    ],
  );
  const origin = points[0]!;
  const area: [number, number, number] = [0, 0, 0];
  for (let i = 1; i < points.length - 1; i++) {
    const triangle = cross(
      subtract(points[i]!, origin),
      subtract(points[i + 1]!, origin),
    );
    for (let axis = 0; axis < 3; axis++) area[axis]! += triangle[axis]!;
  }
  const magnitude = Math.hypot(...area);
  const normal: PolygonMeshPoint = [
    area[0] / magnitude,
    area[1] / magnitude,
    area[2] / magnitude,
  ];
  const offsets = points.map((p) => subtract(p, origin));
  const extent = Math.max(...offsets.map((p) => Math.hypot(...p)));
  const residual = Math.max(...offsets.map((p) => Math.abs(dot(p, normal))));
  expect(residual).toBeGreaterThan(extent * 1e-5);
}

function checkSurface(
  outline: readonly PolygonMeshPoint[],
  holes: readonly (readonly PolygonMeshPoint[])[] = [],
): void {
  const asset = createPolygonMeshAsset({ faces: [{ outline, holes }] });
  expect(validateMeshAsset(asset).valid).toBe(true);
  const data = asset.vertexStreams[0]!.data;
  const indices = asset.indexBuffer!.data;
  const input = [outline, ...holes].flat();
  expect(indices.length).toBe((input.length + 2 * holes.length - 2) * 3);
  const expected = new Set(input.map((p) => p.map(Math.fround).join(",")));
  const points: PolygonMeshPoint[] = [];
  const normals: PolygonMeshPoint[] = [];
  for (let i = 0; i < data.length; i += 8) {
    const p: PolygonMeshPoint = [data[i]!, data[i + 1]!, data[i + 2]!];
    expect(expected.has(p.join(","))).toBe(true);
    points.push(p);
    normals.push([data[i + 3]!, data[i + 4]!, data[i + 5]!]);
    expect(data[i + 6]).toBeGreaterThanOrEqual(0);
    expect(data[i + 6]).toBeLessThanOrEqual(1);
    expect(data[i + 7]).toBeGreaterThanOrEqual(0);
    expect(data[i + 7]).toBeLessThanOrEqual(1);
  }
  expect(new Set(points.map((p) => p.join(",")))).toEqual(expected);
  const authoredNormal = cross(
    subtract(outline[1]!, outline[0]!),
    subtract(outline[3]!, outline[0]!),
  );
  let axis = 0;
  for (let i = 1; i < 3; i++)
    if (Math.abs(authoredNormal[i]!) > Math.abs(authoredNormal[axis]!))
      axis = i;
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const projectedCross = (
    a: PolygonMeshPoint,
    b: PolygonMeshPoint,
    c: PolygonMeshPoint,
  ): number =>
    (b[u]! - a[u]!) * (c[v]! - a[v]!) - (b[v]! - a[v]!) * (c[u]! - a[u]!);
  let emittedArea = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = points[indices[i]!]!;
    const b = points[indices[i + 1]!]!;
    const c = points[indices[i + 2]!]!;
    const triangleNormal = cross(subtract(b, a), subtract(c, a));
    expect(dot(triangleNormal, authoredNormal)).toBeGreaterThan(0);
    expect(dot(triangleNormal, normals[indices[i]!]!)).toBeGreaterThan(0);
    emittedArea += Math.abs(projectedCross(a, b, c)) / 2;
    for (const hole of holes) {
      const center: PolygonMeshPoint = [
        hole.reduce((sum, p) => sum + Math.fround(p[0]), 0) / hole.length,
        hole.reduce((sum, p) => sum + Math.fround(p[1]), 0) / hole.length,
        hole.reduce((sum, p) => sum + Math.fround(p[2]), 0) / hole.length,
      ];
      const sides = [
        projectedCross(a, b, center),
        projectedCross(b, c, center),
        projectedCross(c, a, center),
      ];
      expect(sides.every((x) => x > 0) || sides.every((x) => x < 0)).toBe(
        false,
      );
    }
  }
  const ringArea = (ring: readonly PolygonMeshPoint[]): number => {
    const rounded = ring.map(
      (p): PolygonMeshPoint => [
        Math.fround(p[0]),
        Math.fround(p[1]),
        Math.fround(p[2]),
      ],
    );
    let twiceArea = 0;
    for (let i = 1; i < rounded.length - 1; i++)
      twiceArea += projectedCross(rounded[0]!, rounded[i]!, rounded[i + 1]!);
    return Math.abs(twiceArea) / 2;
  };
  const coveredArea =
    ringArea(outline) - holes.reduce((sum, hole) => sum + ringArea(hole), 0);
  expect(emittedArea / coveredArea).toBeCloseTo(1, 7);
}

const center: PolygonMeshPoint = [
  clipped.reduce((sum, p) => sum + p[0], 0) / clipped.length,
  clipped.reduce((sum, p) => sum + p[1], 0) / clipped.length,
  clipped.reduce((sum, p) => sum + p[2], 0) / clipped.length,
];
const toward = (
  a: PolygonMeshPoint,
  b: PolygonMeshPoint,
  t: number,
): PolygonMeshPoint => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const hole = [clipped[0]!, clipped[1]!, clipped[2]!].map((p) =>
  toward(center, p, 0.2),
);

describe("polygon Float32 planarity precision", () => {
  it("retains every rounded corner of a planar clipped face", () => {
    expectRoundingFallback(clipped);
    checkSurface(clipped);
  });

  it("preserves complete coverage and outward winding across scales and axes", () => {
    for (const scale of [0.5, 1, 2])
      for (const axis of [0, 1, 2])
        for (const reverse of [false, true]) {
          const outline = clipped.map(
            (p): PolygonMeshPoint => [
              p[axis]! * scale,
              p[(axis + 1) % 3]! * scale,
              p[(axis + 2) % 3]! * scale,
            ],
          );
          if (reverse) outline.splice(1, 3, ...outline.slice(1).reverse());
          expectRoundingFallback(outline);
          checkSurface(outline);
        }
  });

  it("does not excuse an authored bend as coordinate rounding", () => {
    for (const bend of [-0.00002, 0.00002]) {
      const outline = clipped.map((p): [number, number, number] => [...p]);
      outline[1]![1] += bend;
      expect(() => createPolygonMeshAsset({ faces: [{ outline }] })).toThrow(
        /coplanar/,
      );
    }
  });

  it("rejects a bent source even when its rounded points match the planar regression", () => {
    const outline = clipped.map((p): [number, number, number] => [...p]);
    outline[1]![1] += 1e-8;
    expect(outline.map((p) => p.map(Math.fround))).toEqual(
      clipped.map((p) => p.map(Math.fround)),
    );
    expect(() => createPolygonMeshAsset({ faces: [{ outline }] })).toThrow(
      /coplanar/,
    );
  });

  it("rejects a skinny face whose apparently stable normal hides rounding uncertainty", () => {
    const ulp = 2 ** -16;
    const width = 0.001;
    const z = 128 + 0.49 * ulp;
    const outline: PolygonMeshPoint[] = [
      [0, 0, z],
      [1, 0, z + 0.02 * ulp],
      [1, width, z + ulp],
      [0, width / 49, z + 0.02 * ulp],
    ];
    expect(() => createPolygonMeshAsset({ faces: [{ outline }] })).toThrow(
      /coplanar/,
    );
  });

  it("rejects large-origin distortion and collapsed coordinates", () => {
    for (const shift of [10, 1000, 1_000_000]) {
      const outline = clipped.map(
        (p): PolygonMeshPoint => [p[0] + shift, p[1] + shift, p[2] + shift],
      );
      if (shift === 10) expectRoundingFallback(outline);
      expect(() => createPolygonMeshAsset({ faces: [{ outline }] })).toThrow();
    }
  });

  it("preserves an opening and a concave notch without filling either", () => {
    expectRoundingFallback(clipped);
    checkSurface(clipped, [hole]);
    const concave = [
      clipped[0]!,
      clipped[1]!,
      center,
      clipped[2]!,
      clipped[3]!,
    ];
    expectRoundingFallback(concave);
    checkSurface(concave);
  });

  it("keeps winding and coverage when the dominant projection axes nearly tie", () => {
    for (const slope of [1 - 1e-8, 1, 1 + 1e-8])
      for (const swap of [false, true]) {
        const outline = clipped.map(([x, y]): PolygonMeshPoint => {
          const z = -(y - 4) * slope - 2;
          return swap ? [x, z, y] : [x, y, z];
        });
        expectRoundingFallback(outline);
        checkSurface(outline);
      }
  });

  it("still rejects off-plane holes and holes touching the rounded boundary", () => {
    const bentHole = hole.map((p): [number, number, number] => [...p]);
    bentHole[1]![1] += 0.00001;
    expect(() =>
      createPolygonMeshAsset({
        faces: [{ outline: clipped, holes: [bentHole] }],
      }),
    ).toThrow(/coplanar/);
    const touching = toward(clipped[0]!, center, 1e-8);
    expect(touching.map(Math.fround)).toEqual(clipped[0]!.map(Math.fround));
    expect(() =>
      createPolygonMeshAsset({
        faces: [{ outline: clipped, holes: [[touching, hole[1]!, hole[2]!]] }],
      }),
    ).toThrow();
  });
});
