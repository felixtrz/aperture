import { describe, expect, it } from "vitest";
import {
  createExtrudeMeshAsset,
  ExtrudeMeshError,
  validateMeshAsset,
  createMeshGpuUploadPlan,
  createSpatialTriangleMeshFromMeshAsset,
  type ExtrudeMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";

const square = [
  [0, 0],
  [8, 0],
  [8, 6],
  [0, 6],
] as const;
const hole = [
  [1, 2],
  [3, 2],
  [3, 4],
  [1, 4],
] as const;
// Continuous cottage facade: door is an outline notch, window is a hole.
export const cottage: ExtrudeMeshOptions = {
  outline: [
    [0, 0],
    [3, 0],
    [3, 2.5],
    [5, 2.5],
    [5, 0],
    [8, 0],
    [8, 5],
    [4, 7],
    [0, 5],
  ],
  holes: [
    [
      [0.5, 2],
      [2.5, 2],
      [2.5, 4],
      [0.5, 4],
    ],
  ],
  depth: 0.4,
};
function inspect(mesh: MeshAsset) {
  const stream = mesh.vertexStreams[0]!;
  const v = Array.from({ length: stream.vertexCount }, (_, i) =>
    Array.from(stream.data.slice(i * 8, i * 8 + 8)),
  );
  const indices = Array.from(mesh.indexBuffer!.data);
  const edges = new Map<string, number>();
  let volume = 0;
  let capArea = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = v[indices[i]!]!,
      b = v[indices[i + 1]!]!,
      c = v[indices[i + 2]!]!;
    const ab = b.slice(0, 3).map((x, j) => x - a[j]!),
      ac = c.slice(0, 3).map((x, j) => x - a[j]!);
    const n = [
      ab[1]! * ac[2]! - ab[2]! * ac[1]!,
      ab[2]! * ac[0]! - ab[0]! * ac[2]!,
      ab[0]! * ac[1]! - ab[1]! * ac[0]!,
    ];
    expect(n.reduce((s, x, j) => s + x * a[j + 3]!, 0)).toBeGreaterThan(0);
    expect(Math.hypot(...a.slice(3, 6))).toBeCloseTo(1, 6);
    if (a[5] === 1) capArea += n[2]! / 2;
    volume +=
      (a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) +
        a[1]! * (b[2]! * c[0]! - b[0]! * c[2]!) +
        a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)) /
      6;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = [p!.slice(0, 3).join(","), q!.slice(0, 3).join(",")]
        .sort()
        .join("|");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  // Weld only for this assertion: hard normal/UV seams intentionally split vertices.
  expect(new Set(edges.values())).toEqual(new Set([2]));
  expect(v.flat().every(Number.isFinite)).toBe(true);
  expect(v.every((p) => p.slice(6).every((x) => x >= 0 && x <= 1))).toBe(true);
  return { v, indices, volume, capArea };
}
describe("polygon extrusion", () => {
  it("creates a closed indexed rectangle with correct caps, sides, bounds and upload layout", () => {
    const asset = createExtrudeMeshAsset({ outline: square, depth: 2 });
    const result = inspect(asset);
    expect(result.volume).toBeCloseTo(96);
    expect(result.capArea).toBeCloseTo(48);
    expect(result.v).toHaveLength(24);
    expect(result.indices).toHaveLength(36);
    expect(asset.localAabb).toEqual({ min: [0, 0, 0], max: [8, 6, 2] });
    expect(validateMeshAsset(asset)).toEqual({ valid: true, diagnostics: [] });
    expect(createMeshGpuUploadPlan(asset)).toMatchObject({
      valid: true,
      diagnostics: [],
    });
    expect(createSpatialTriangleMeshFromMeshAsset(asset)).toMatchObject({
      diagnostics: [],
    });
  });
  it("triangulates the concave cottage facade and its window as one closed solid", () => {
    const result = inspect(createExtrudeMeshAsset(cottage));
    expect(result.capArea).toBeCloseTo(39);
    expect(result.volume).toBeCloseTo(39 * 0.4);
  });
  it("supports multiple holes and normalizes winding/start vertices deterministically without mutating input", () => {
    const options: ExtrudeMeshOptions = {
      outline: square,
      holes: [
        hole,
        [
          [5, 2],
          [7, 2],
          [7, 4],
          [5, 4],
        ],
      ],
      depth: 1,
    };
    const before = JSON.stringify(options);
    const expected = createExtrudeMeshAsset(options);
    expect(inspect(expected).capArea).toBeCloseTo(40);
    const reversed = {
      ...options,
      outline: [...square].reverse(),
      holes: options.holes!.map((r) => [...r].reverse()),
    };
    expect(createExtrudeMeshAsset(reversed)).toEqual(expected);
    expect(createExtrudeMeshAsset(options)).toEqual(expected);
    expect(JSON.stringify(options)).toBe(before);
  });
  it("does not cover a hole with cap triangles", () => {
    const { v, indices } = inspect(
      createExtrudeMeshAsset({ outline: square, holes: [hole], depth: 1 }),
    );
    for (let i = 0; i < indices.length; i += 3) {
      const points = indices.slice(i, i + 3).map((j) => v[j]!);
      if (points[0]![5] !== 1) continue;
      const x = points.reduce((s, p) => s + p[0]!, 0) / 3,
        y = points.reduce((s, p) => s + p[1]!, 0) / 3;
      expect(x > 1 && x < 3 && y > 2 && y < 4).toBe(false);
    }
  });
  it.each([
    [null, "options"],
    [{ outline: new Array(3), depth: 1 }, "outline[0]"],
    [{ outline: square, depth: Symbol() }, "depth"],
    [{ outline: square, depth: 0 }, "depth"],
    [{ outline: square, depth: -1 }, "depth"],
    [{ outline: square, depth: Infinity }, "depth"],
    [{ outline: square, depth: 1e-50 }, "depth"],
    [{ outline: square, depth: 1, label: 2 }, "label"],
    [{ outline: square, depth: 1, holes: null }, "holes"],
    [{ outline: [], depth: 1 }, "outline"],
    [
      {
        outline: [
          [0, 0],
          [1, 0],
          [NaN, 1],
        ],
        depth: 1,
      },
      "outline[2]",
    ],
    [
      {
        outline: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
        depth: 1,
      },
      "outline",
    ],
    [
      {
        outline: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
        ],
        depth: 1,
      },
      "outline[1]",
    ],
    [
      {
        outline: [
          [0, 0],
          [2, 2],
          [0, 2],
          [2, 0],
        ],
        depth: 1,
      },
      "outline",
    ],
    [
      {
        outline: [
          [1e8, 0],
          [1e8 + 1, 0],
          [1e8, 1],
        ],
        depth: 1,
      },
      "outline[0]",
    ],
    [
      {
        outline: square,
        depth: 1,
        holes: [
          [
            [8, 1],
            [9, 1],
            [9, 2],
            [8, 2],
          ],
        ],
      },
      "holes[0]",
    ],
    [
      {
        outline: square,
        depth: 1,
        holes: [
          [
            [9, 1],
            [10, 1],
            [10, 2],
            [9, 2],
          ],
        ],
      },
      "holes[0]",
    ],
    [{ outline: square, depth: 1, holes: [hole, hole] }, "holes[1]"],
    [
      {
        outline: square,
        depth: 1,
        holes: [
          hole,
          [
            [1.5, 2.5],
            [2.5, 2.5],
            [2.5, 3.5],
            [1.5, 3.5],
          ],
        ],
      },
      "holes[1]",
    ],
    [
      {
        outline: square,
        depth: 1,
        holes: [
          hole,
          [
            [2, 3],
            [4, 3],
            [4, 5],
            [2, 5],
          ],
        ],
      },
      "holes[1]",
    ],
    [
      {
        outline: Array.from({ length: 2049 }, (_, i) => [
          Math.cos(i),
          Math.sin(i),
        ]),
        depth: 1,
      },
      "outline",
    ],
  ])("rejects malformed or unsupported topology (%j)", (options, path) => {
    expect(() => createExtrudeMeshAsset(options as ExtrudeMeshOptions)).toThrow(
      ExtrudeMeshError,
    );
    try {
      createExtrudeMeshAsset(options as ExtrudeMeshOptions);
    } catch (error) {
      expect((error as ExtrudeMeshError).path).toMatch(
        new RegExp(`^${String(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
    }
  });
});

it("matches the actual courtyard facade's door notch and window dimensions", () => {
  const asset = createExtrudeMeshAsset({
    outline: [
      [-1.65, 0.35],
      [-1.03, 0.35],
      [-1.03, 2.05],
      [-0.13, 2.05],
      [-0.13, 0.35],
      [1.65, 0.35],
      [1.65, 3.05],
      [-1.65, 3.05],
    ],
    holes: [
      [
        [0.51, 1.25],
        [1.31, 1.25],
        [1.31, 2.05],
        [0.51, 2.05],
      ],
    ],
    depth: 0.18,
  });
  const result = inspect(asset);
  expect(result.capArea).toBeCloseTo(3.3 * 2.7 - 0.9 * 1.7 - 0.8 * 0.8, 5);
  expect(result.volume).toBeCloseTo(6.74 * 0.18, 5);
  expect(result.v).toHaveLength(72);
  expect(result.indices).toHaveLength(144);
});

it("accepts the minimum ring and the documented 2048-vertex limit", () => {
  const triangle = createExtrudeMeshAsset({
    outline: [
      [0, 0],
      [2, 0],
      [0, 2],
    ],
    depth: 1,
  });
  expect(inspect(triangle).volume).toBeCloseTo(2);
  const outline = Array.from(
    { length: 2048 },
    (_, i) =>
      [Math.cos((i * Math.PI) / 1024), Math.sin((i * Math.PI) / 1024)] as const,
  );
  const maximum = createExtrudeMeshAsset({ outline, depth: 1 });
  expect(maximum.vertexStreams[0]!.vertexCount).toBe(2048 * 6);
  expect(maximum.indexBuffer!.data.length).toBe((2048 * 4 - 4) * 3);
  expect(validateMeshAsset(maximum)).toEqual({ valid: true, diagnostics: [] });
}, 10_000);
