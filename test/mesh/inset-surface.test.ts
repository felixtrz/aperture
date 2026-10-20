import { describe, expect, it } from "vitest";
import {
  createPolygonMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  insetSurface,
  triangleFan,
  type Face,
  type Point,
} from "../../examples/fitted-props/src/panels.ts";

function triangles(faces: readonly Face[]): Point[][] {
  const asset: MeshAsset = createPolygonMeshAsset({ faces });
  expect(validateMeshAsset(asset).valid).toBe(true);
  const data = asset.vertexStreams[0]!.data as Float32Array;
  return Array.from({ length: asset.indexBuffer!.data.length / 3 }, (_, i) =>
    Array.from(
      asset.indexBuffer!.data.slice(i * 3, i * 3 + 3),
      (index): Point => [
        data[index * 8]!,
        data[index * 8 + 1]!,
        data[index * 8 + 2]!,
      ],
    ),
  );
}

/** Independent +Z ray intersection in the emitted float32 triangle soup. */
function hits(faces: readonly Face[], x: number, y: number): number[] {
  return triangles(faces).flatMap(([a, b, c]) => {
    const det =
      (b![1] - c![1]) * (a![0] - c![0]) + (c![0] - b![0]) * (a![1] - c![1]);
    if (Math.abs(det) < 1e-12) return [];
    const u =
      ((b![1] - c![1]) * (x - c![0]) + (c![0] - b![0]) * (y - c![1])) / det;
    const v =
      ((c![1] - a![1]) * (x - c![0]) + (a![0] - c![0]) * (y - c![1])) / det;
    return u > 0 && v > 0 && u + v < 1
      ? [u * a![2] + v * b![2] + (1 - u - v) * c![2]]
      : [];
  });
}

const panel: Point[] = [
  [-2, -1, 0],
  [2, -1, 0],
  [2, 1, 0],
  [-2, 1, 0],
];
const opening: Point[] = [
  [-0.9, -0.6, 0],
  [0.9, -0.6, 0],
  [1, -0.5, 0],
  [1, 0.5, 0],
  [0.9, 0.6, 0],
  [-0.9, 0.6, 0],
  [-1, 0.5, 0],
  [-1, -0.5, 0],
];

describe("shared-boundary inset and cap recipes", () => {
  it("leaves an actual opening, with a recessed pane and no face at its mouth", () => {
    const part = insetSurface(panel, opening, 0.125);
    const faces = [part.surround, ...part.reveals, part.inset];
    expect(hits([part.surround], 0.23, 0.17)).toEqual([]);
    expect(hits(faces, 0.23, 0.17)).toEqual([-0.125]);
    expect(hits(faces, 1.5, 0.21)).toEqual([0]);
    expect(part.surround.holes![0]).toContain(part.reveals[0]!.outline[0]);
    expect(part.inset.outline).toContain(part.reveals[0]!.outline[2]);

    // Only the outer perimeter may remain open. Material partitions meet once
    // in opposite directions, including the chamfered aperture corners.
    const edges = new Map<string, { count: number; direction: number }>();
    for (const tri of triangles(faces))
      for (let i = 0; i < 3; i++) {
        const a = tri[i]!.join(","),
          b = tri[(i + 1) % 3]!.join(",");
        const key = [a, b].sort().join("|");
        const value = edges.get(key) ?? { count: 0, direction: 0 };
        value.count++;
        value.direction += a < b ? 1 : -1;
        edges.set(key, value);
      }
    expect([...edges.values()].filter((e) => e.count === 1)).toHaveLength(4);
    for (const edge of edges.values()) {
      expect([1, 2]).toContain(edge.count);
      if (edge.count === 2) expect(edge.direction).toBe(0);
    }
  });

  it("preserves edited, tilted construction boundaries without mutating inputs", () => {
    const before = JSON.stringify({ panel, opening });
    for (const scale of [0.1, 1, 12]) {
      const pose = ([x, y, z]: Point): Point => [
        3 + x * scale,
        -2 + (y * 0.6 - z * 0.8) * scale,
        1 + (y * 0.8 + z * 0.6) * scale,
      ];
      const outer = panel.map(pose);
      const inner = opening.map(pose);
      const part = insetSurface(outer, inner, 0.125 * scale, "sloped display");
      triangles([part.surround, ...part.reveals, part.inset]);
      expect(part.surround.outline).toBe(outer);
      for (let i = 0; i < inner.length; i++) {
        const p = part.inset.outline[i]!;
        expect(p[0]).toBeCloseTo(inner[i]![0], 8);
        expect(p[1] - inner[i]![1]).toBeCloseTo(0.1 * scale, 8);
        expect(p[2] - inner[i]![2]).toBeCloseTo(-0.075 * scale, 8);
      }
    }
    expect(JSON.stringify({ panel, opening })).toBe(before);
  });

  it("uses polygon containment for a concave ground boundary and recessed pond", () => {
    const outer: Point[] = [
      [-3, 0, 2],
      [3, 0, 2],
      [3, 0, -2],
      [1, 0, -2],
      [1, 0, -1],
      [-3, 0, -1],
    ];
    const shore: Point[] = [
      [-1, 0, 1],
      [1.5, 0, 1],
      [1.2, 0, 0],
      [-0.8, 0, -0.5],
    ];
    const part = insetSurface(outer, shore, 0.08, "courtyard pool");
    triangles([part.surround, ...part.reveals, part.inset]);
    expect(part.inset.outline.every((p) => p[1] === -0.08)).toBe(true);
    const escaped = shore.map(([x, y, z]): Point => [x + 2, y, z]);
    const invalid = insetSurface(outer, escaped, 0.08);
    expect(() => createPolygonMeshAsset({ faces: [invalid.surround] })).toThrow(
      /holes.*(intersect|inside|outside)/,
    );
    const touching = insetSurface(
      outer,
      shore.map(([x, y, z]): Point => [x, y, z + 1]),
      0.08,
    );
    expect(() =>
      createPolygonMeshAsset({ faces: [touching.surround] }),
    ).toThrow(/holes.*(intersect|touch)/);
  });

  it("rejects invalid recess depth or a hole outside the surface plane", () => {
    for (const depth of [0, -1, NaN, Infinity])
      expect(() => insetSurface(panel, opening, depth, "window")).toThrow(
        /window: depth/,
      );
    expect(() =>
      insetSurface(
        panel,
        opening.map(([x, y, z]): Point => [x, y, z + 0.1]),
        0.1,
        "window",
      ),
    ).toThrow(/window: opening.*plane/);
  });

  it("caps a bent open arch without inventing a degenerate closing triangle", () => {
    const arch: Point[] = [
      [-1, 0, 0],
      [-0.8, 0.6, -0.1],
      [-0.4, 0.9, -0.2],
      [0.4, 0.9, -0.2],
      [0.8, 0.6, -0.1],
      [1, 0, 0],
    ];
    const center: Point = [0, 0, 0];
    const faces = triangleFan(arch, center, [0, 0, 1]);
    expect(faces).toHaveLength(5);
    triangles(faces);
    for (const [a, b, c] of triangles(faces))
      expect(
        (b![0] - a![0]) * (c![1] - a![1]) - (b![1] - a![1]) * (c![0] - a![0]),
      ).toBeGreaterThan(0);
    expect(() => triangleFan(arch, center, [0, 0, 1], true, "arch")).toThrow(
      /arch: triangle 5 is degenerate/,
    );
    expect(() =>
      createPolygonMeshAsset({ faces: [{ outline: arch }] }),
    ).toThrow(/not coplanar/);
  });

  it("supports a closed fan and rejects folded order rather than flipping individual faces", () => {
    expect(triangleFan(panel, [0, 0, 0], [0, 0, 1], true)).toHaveLength(4);
    triangles(triangleFan([...panel].reverse(), [0, 0, 0], [0, 0, 1], true));
    expect(() =>
      triangleFan(
        [panel[0]!, panel[1]!, panel[3]!, panel[2]!],
        [0, 0, -0.2],
        [0, 0, 1],
        true,
        "folded cap",
      ),
    ).toThrow(/folded cap: triangle \d+ (reverses|is degenerate)/);
    const star = [0, 2, 4, 1, 3].map(
      (i): Point => [
        Math.cos((i * 2 * Math.PI) / 5),
        Math.sin((i * 2 * Math.PI) / 5),
        0,
      ],
    );
    expect(() => triangleFan(star, [0, 0, 0], [0, 0, 1], true)).toThrow(
      /sweep once without overlap/,
    );
  });

  it("measures a narrow fan's projected sweep without cancellation from its depth", () => {
    for (const scale of [0.0001, 1]) {
      const profile = Array.from(
        { length: 5 },
        (_, i): Point => [
          Math.cos((i * 2 * Math.PI) / 5) * scale,
          Math.sin((i * 2 * Math.PI) / 5) * scale,
          10000 * scale,
        ],
      );
      const faces = triangleFan(profile, [0, 0, 0], [0, 0, 1], true);
      expect(faces).toHaveLength(5);
      triangles(faces);
    }
  });
});
