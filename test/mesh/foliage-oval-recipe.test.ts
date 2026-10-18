import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTriangleListMeshAsset } from "@aperture-engine/render";
import {
  branchFoliageBatches,
  foliageBatches,
  leafletTriangles,
  type BranchFoliageOptions,
  type FoliageBatch,
  type FoliageOptions,
  type FoliagePoint,
  type LeafletProfile,
} from "../../examples/planar-reflections/src/foliage.ts";

const leaflet = { length: 0.22, width: 0.11, thickness: 0.025 };
const ellipsoid: FoliageOptions = {
  seed: 37,
  leaflet,
  clusters: [
    { center: [0, 0.4, 0], spread: [0.45, 0.3, 0.35], count: 3 },
    {
      center: [0.35, 0.6, 0],
      spread: [0.3, 0.4, 0.25],
      count: 2,
      batch: 1,
      rotationEulerDegrees: [12, 38, -7],
    },
  ],
};
const branch: BranchFoliageOptions = {
  seed: 37,
  leaflet,
  branches: [
    {
      path: [
        [0, 0, 0],
        [1, 1, 0],
        [2, 1, 1],
      ],
      pairs: 12,
      batch: 0,
    },
    {
      path: [
        [1, 0, 0],
        [1, 2, 1],
      ],
      pairs: 9,
      batch: 1,
    },
  ],
};
const points = (batches: readonly FoliageBatch[]): FoliagePoint[] =>
  batches.flatMap(({ mesh }) => {
    if (mesh.kind !== "triangle-list")
      throw new Error("Expected triangle list");
    return [...mesh.options.positions];
  });
const leaves = (
  batches: readonly FoliageBatch[],
  corners = 72,
): FoliagePoint[][] => {
  const p = points(batches);
  return Array.from({ length: p.length / corners }, (_, i) =>
    p.slice(i * corners, (i + 1) * corners),
  );
};
const sub = (a: FoliagePoint, b: FoliagePoint): FoliagePoint => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dot = (a: FoliagePoint, b: FoliagePoint): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: FoliagePoint, b: FoliagePoint): FoliagePoint => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const fingerprint = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

function checkClosedOutward(leaf: readonly FoliagePoint[]): void {
  expect(leaf.every((p) => p.every(Number.isFinite))).toBe(true);
  expect(new Set(leaf.map((p) => p.join(","))).size).toBe(14);
  const center = [0, 1, 2].map(
    (axis) => leaf.reduce((s, p) => s + p[axis]!, 0) / leaf.length,
  ) as [number, number, number];
  const edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < leaf.length; i += 3) {
    const a = leaf[i]!,
      b = leaf[i + 1]!,
      c = leaf[i + 2]!;
    const outward = dot(cross(sub(b, a), sub(c, a)), sub(a, center));
    expect(outward).toBeGreaterThan(0);
    volume += outward / 6;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const edge = `${p}|${q}`;
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  expect(volume).toBeGreaterThan(0);
  for (const [edge, count] of edges) {
    expect(count).toBe(1);
    expect(edges.get(edge.split("|").reverse().join("|"))).toBe(1);
  }
}

describe("rounded foliage example recipe", () => {
  it("keeps the authored full extents and broadens the rim without open faces", () => {
    const oval = leafletTriangles(leaflet, "oval");
    checkClosedOutward(oval);
    for (const [axis, extent] of [
      leaflet.width,
      leaflet.length,
      leaflet.thickness,
    ].entries()) {
      const values = oval.map((p) => p[axis]!);
      expect(Math.min(...values)).toBe(-extent / 2);
      expect(Math.max(...values)).toBe(extent / 2);
    }
    const rim = Array.from({ length: 12 }, (_, i) => oval[i * 6 + 1]!);
    // The new profile must add blade area, not just subdivide diamond edges.
    const area =
      rim.reduce((sum, a, i) => {
        const b = rim[(i + 1) % rim.length]!;
        return sum + a[0] * b[1] - a[1] * b[0];
      }, 0) / 2;
    expect(area).toBeCloseTo(0.75 * leaflet.length * leaflet.width, 12);
    expect(area).toBeGreaterThan(0.7 * leaflet.length * leaflet.width);
  });

  for (const kind of ["ellipsoid", "branch"] as const) {
    const generate = (profile?: LeafletProfile, seed = 37): FoliageBatch[] => {
      const profileOptions =
        profile === undefined ? {} : { leafletProfile: profile };
      return kind === "ellipsoid"
        ? foliageBatches({ ...ellipsoid, seed, ...profileOptions })
        : branchFoliageBatches({ ...branch, seed, ...profileOptions });
    };

    it(`${kind}: preserves descriptor and GPU bytes for default and explicit diamond`, () => {
      // Fingerprints recorded before adding oval support, from these exact fixtures.
      const expected =
        kind === "ellipsoid"
          ? [
              "a3c11ef60feff0c26ebbea7a8d9ac64980f340c09df17555a3d11c3c975c9979",
              "45da8510885ed6e1c453c0be6bcce4f80629592e587270b5d0bf468fb6d2781e",
            ]
          : [
              "a80f2b62c53b232296a127ebcf20cdd670df79f86f6fb27415196093c3bbd9a7",
              "cf99a863d9e7058a5daf21ca77f8256c64ab1e875710e36a24685410d45de1af",
            ];
      const result = generate();
      expect(generate("diamond")).toEqual(result);
      expect(fingerprint(JSON.stringify(result))).toBe(expected[0]);
      expect(
        fingerprint(
          new Uint8Array(new Float32Array(points(result).flat()).buffer),
        ),
      ).toBe(expected[1]);
    });

    it(`${kind}: keeps Float32 faces closed, outward and mesh-compatible`, () => {
      const result = generate("oval");
      for (const leaf of leaves(result)) {
        expect(leaf.every((p) => p.every((v) => Math.fround(v) === v))).toBe(
          true,
        );
        checkClosedOutward(leaf);
      }
      expect(() =>
        createTriangleListMeshAsset({ positions: points(result) }),
      ).not.toThrow();
      expect(result.every((b) => b.triangleCount === b.leafletCount * 24)).toBe(
        true,
      );
    });

    it(`${kind}: replays deterministically and preserves the original placement and size`, () => {
      const originalInput = structuredClone(
        kind === "ellipsoid" ? ellipsoid : branch,
      );
      const result = generate("oval");
      expect(generate("oval")).toEqual(result);
      expect(generate("oval", 38)).not.toEqual(result);
      expect(kind === "ellipsoid" ? ellipsoid : branch).toEqual(originalInput);
      const diamond = leaves(generate(), 24);
      for (const [i, leaf] of leaves(result).entries()) {
        // Both face centers and the four cardinal rim points match in GPU space.
        // This detects changed random draws, frames, translations or size semantics.
        for (const [ovalIndex, diamondIndex] of [
          [0, 0],
          [3, 3],
          [1, 1],
          [19, 7],
          [37, 13],
          [55, 19],
        ]) {
          expect(leaf[ovalIndex!]!).toEqual(
            diamond[i]![diamondIndex!]!.map(Math.fround),
          );
        }
      }
    });

    it(`${kind}: rejects invalid profiles even with no generated leaves`, () => {
      for (const invalid of ["round", "", null, 12, {}]) {
        const leafletProfile = invalid as LeafletProfile;
        expect(() =>
          kind === "ellipsoid"
            ? foliageBatches({ ...ellipsoid, leafletProfile, clusters: [] })
            : branchFoliageBatches({ ...branch, leafletProfile, branches: [] }),
        ).toThrow(/leafletProfile/);
      }
    });

    it(`${kind}: rejects dimensions or positions that collapse at Float32 precision`, () => {
      for (const thickness of [0, -1, NaN, Infinity, 1e-300]) {
        const size = { ...leaflet, thickness };
        expect(() =>
          kind === "ellipsoid"
            ? foliageBatches({
                ...ellipsoid,
                leaflet: size,
                leafletProfile: "oval",
              })
            : branchFoliageBatches({
                ...branch,
                leaflet: size,
                leafletProfile: "oval",
              }),
        ).toThrow(/positive|Float32 precision/);
      }
      expect(() =>
        kind === "ellipsoid"
          ? foliageBatches({
              ...ellipsoid,
              leafletProfile: "oval",
              clusters: [
                { center: [1e30, 1e30, 1e30], spread: [0, 0, 0], count: 1 },
              ],
            })
          : branchFoliageBatches({
              ...branch,
              leafletProfile: "oval",
              branches: [
                {
                  path: [
                    [1e30, 1e30, 1e30],
                    [2e30, 1e30, 1e30],
                  ],
                  pairs: 1,
                },
              ],
            }),
      ).toThrow(/Float32 precision/);
    });
  }

  it("keeps oval branch leaves outward through vertical and reversing frames", () => {
    const result = branchFoliageBatches({
      ...branch,
      leafletProfile: "oval",
      branches: [
        {
          path: [
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
            [0, 1, 0],
          ],
          pairs: 20,
        },
        {
          path: [
            [0, 0, 0],
            [1e-8, 1, 1e-8],
          ],
          pairs: 5,
          up: [0, 1, 0],
        },
      ],
    });
    leaves(result).forEach(checkClosedOutward);
  });

  it("bounds oval allocations before generating geometry", () => {
    expect(() =>
      foliageBatches({
        ...ellipsoid,
        leafletProfile: "oval",
        clusters: [{ ...ellipsoid.clusters[0]!, count: 40001 }],
      }),
    ).toThrow(/40000 leaves/);
    expect(() =>
      foliageBatches({
        ...ellipsoid,
        leafletProfile: "oval",
        clusters: [
          { ...ellipsoid.clusters[0]!, count: 20001 },
          { ...ellipsoid.clusters[0]!, count: 20000 },
        ],
      }),
    ).toThrow(/40000 leaves/);
    expect(() =>
      foliageBatches({
        ...ellipsoid,
        leafletProfile: "oval",
        clusters: Array.from({ length: 1025 }, () => ({
          ...ellipsoid.clusters[0]!,
          count: 0,
        })),
      }),
    ).toThrow(/1024 clusters/);
    expect(() =>
      branchFoliageBatches({
        ...branch,
        leafletProfile: "oval",
        branches: [{ ...branch.branches[0]!, pairs: 20001 }],
      }),
    ).toThrow(/20000 candidate pairs/);
    expect(
      foliageBatches({
        ...ellipsoid,
        leafletProfile: "oval",
        clusters: Array.from({ length: 1024 }, () => ({
          ...ellipsoid.clusters[0]!,
          count: 0,
        })),
      }),
    ).toEqual([]);
    expect(
      branchFoliageBatches({
        ...branch,
        leafletProfile: "oval",
        branches: [{ ...branch.branches[0]!, pairs: 20000, density: [0, 0] }],
      }),
    ).toEqual([]);
  });
});
