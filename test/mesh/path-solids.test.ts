import { describe, expect, it } from "vitest";
import { mesh } from "@aperture-engine/app/systems";
import {
  createTriangleListMeshAsset,
  extrudeBetweenTriangleListOptions,
  tubeTriangleListOptions,
  type TriangleListMeshOptions,
  type TriangleListPosition as Point,
} from "@aperture-engine/render";

function closedEdges(options: TriangleListMeshOptions): void {
  const counts = new Map<string, number>(),
    directed = new Map<string, number>();
  const ids = options.indices!;
  for (let i = 0; i < ids.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = ids[i + j]!,
        b = ids[i + ((j + 1) % 3)]!,
        key = [Math.min(a, b), Math.max(a, b)].join(":");
      counts.set(key, (counts.get(key) ?? 0) + 1);
      directed.set(key, (directed.get(key) ?? 0) + (a < b ? 1 : -1));
    }
  expect([...counts.values()].every((n) => n === 2)).toBe(true);
  expect([...directed.values()].every((n) => n === 0)).toBe(true);
}
const rectangle = [
  [-0.2, -0.1],
  [0.2, -0.1],
  [0.2, 0.1],
  [-0.2, 0.1],
] as const;

describe("endpoint and path solids", () => {
  it("extrudes a profile between arbitrary endpoints with outward caps and exact endpoint planes", () => {
    for (const end of [
      [2, 3, 4],
      [0, -3, 0],
      [0, 3, 0],
      [-3, 0, 0],
    ] as Point[]) {
      const options = extrudeBetweenTriangleListOptions({
        outline: rectangle,
        start: [0, 0, 0],
        end,
      });
      closedEdges(options);
      const asset = createTriangleListMeshAsset(options);
      const d = asset.vertexStreams[0]!.data;
      expect(d[3]! * end[0] + d[4]! * end[1] + d[5]! * end[2]).toBeLessThan(0);
      const length2 = end.reduce((s, v) => s + v * v, 0);
      options.positions.forEach((p, i) =>
        expect(p.reduce((s, v, k) => s + v * end[k]!, 0)).toBeCloseTo(
          i < 4 ? 0 : length2,
          6,
        ),
      );
    }
    expect(
      mesh.extrudeBetween({
        outline: rectangle,
        start: [1, 2, 3],
        end: [2, 3, 4],
      }).kind,
    ).toBe("triangle-list");
  });
  it("keeps concave profile and hole boundaries closed instead of filling openings", () => {
    const options = extrudeBetweenTriangleListOptions({
      outline: [
        [-2, -2],
        [2, -2],
        [2, 2],
        [0, 1],
        [-2, 2],
      ],
      holes: [
        [
          [-0.3, -0.7],
          [0.3, -0.7],
          [0.3, 0.3],
          [-0.3, 0.3],
        ],
      ],
      start: [0, 0, 0],
      end: [0, 0, 2],
    });
    closedEdges(options);
    expect(createTriangleListMeshAsset(options).localAabb).toEqual({
      min: [-2, -2, 0],
      max: [2, 2, 2],
    });
    // Front cap area = outer area (14) minus opening (0.6).
    let area = 0;
    for (let i = 0; i < options.indices!.length; i += 3) {
      const p = [0, 1, 2].map(
        (j) => options.positions[options.indices![i + j]!]!,
      );
      if (p.every((v) => v[2] === 0))
        area +=
          Math.abs(
            (p[1]![0] - p[0]![0]) * (p[2]![1] - p[0]![1]) -
              (p[1]![1] - p[0]![1]) * (p[2]![0] - p[0]![0]),
          ) / 2;
    }
    expect(area).toBeCloseTo(13.4, 5);
  });
  it("connects sloping, downward and bending paths without gaps, inward caps or frame flips", () => {
    const paths: Point[][] = [
      [
        [0, 0, 0],
        [1, 2, 3],
      ],
      [
        [0, 2, 0],
        [0, -1, 0],
      ],
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0.5, 0.5],
        [2.5, 1, 1.5],
      ],
    ];
    for (const path of paths) {
      const options = tubeTriangleListOptions({
        path,
        radius: path.map((_, i) => 0.12 - i * 0.015),
        radialSegments: 6,
      });
      closedEdges(options);
      expect(() => createTriangleListMeshAsset(options)).not.toThrow();
      // Each joint has one shared ring, exactly centered on the authored point.
      path.forEach((p, i) => {
        for (let axis = 0; axis < 3; axis++)
          expect(
            options.positions
              .slice(i * 6, (i + 1) * 6)
              .reduce((s, v) => s + v[axis]!, 0) / 6,
          ).toBeCloseTo(p[axis]!, 6);
      });
      const volume =
        Array.from({ length: options.indices!.length / 3 }, (_, i) => {
          const [a, b, c] = [0, 1, 2].map(
            (j) => options.positions[options.indices![i * 3 + j]!]!,
          );
          return (
            a![0] * (b![1] * c![2] - b![2] * c![1]) +
            a![1] * (b![2] * c![0] - b![0] * c![2]) +
            a![2] * (b![0] * c![1] - b![1] * c![0])
          );
        }).reduce((a, b) => a + b, 0) / 6;
      expect(volume).toBeGreaterThan(0);
    }
    const open = tubeTriangleListOptions({ path: paths[0]!, capped: false });
    expect(open.positions).toHaveLength(16);
    expect(open.indices).toHaveLength(48);
    expect(mesh.tube({ path: paths[0]! }).kind).toBe("triangle-list");
  });
  it("rejects collapsed, reversing and malformed geometry with actionable fields", () => {
    for (const path of [
      [],
      [[0, 0, 0]],
      [
        [0, 0, 0],
        [0, 0, 0],
      ],
      [
        [0, 0, 0],
        [1, 0, 0],
        [0.5, 0, 0],
      ],
      [
        [0, 0, 0],
        [NaN, 0, 1],
      ],
    ] as Point[][])
      expect(() => tubeTriangleListOptions({ path })).toThrow(/path/);
    for (const radius of [0, -1, Infinity, [0.1]])
      expect(() =>
        tubeTriangleListOptions({
          path: [
            [0, 0, 0],
            [0, 1, 0],
          ],
          radius,
        }),
      ).toThrow(/radius/);
    expect(() =>
      tubeTriangleListOptions({
        path: [
          [0, 0, 0],
          [0, 1, 0],
        ],
        radialSegments: 2,
      }),
    ).toThrow(/radialSegments/);
    expect(() =>
      extrudeBetweenTriangleListOptions({
        outline: rectangle,
        start: [0, 0, 0],
        end: [0, 0, 0],
      }),
    ).toThrow(/start\/end/);
    expect(() =>
      extrudeBetweenTriangleListOptions({
        outline: rectangle,
        start: [0, 0, 0],
        end: [0, 1, 0],
        up: [0, 1, 0],
      }),
    ).toThrow(/up/);
    expect(() =>
      extrudeBetweenTriangleListOptions({
        outline: rectangle,
        start: [NaN, 0, 0],
        end: [0, 1, 0],
      }),
    ).toThrow(/start/);
  });
});
