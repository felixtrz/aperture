import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTriangleListMeshAsset } from "@aperture-engine/render";
import {
  branchFoliageBatches,
  foliageBatches,
  type BranchFoliageOptions,
  type FoliageBatch,
  type FoliagePoint,
} from "../../examples/planar-reflections/src/foliage.ts";

const leaflet = { length: 0.22, width: 0.11, thickness: 0.025 };
const straight: BranchFoliageOptions = {
  seed: 37,
  leaflet,
  sizeVariation: 0,
  leafTiltDegrees: 0,
  branches: [
    {
      path: [
        [0, 0, 0],
        [4, 0, 0],
      ],
      pairs: 12,
      range: [0, 1],
      leafAngleDegrees: 55,
    },
  ],
};

function positions(batches: readonly FoliageBatch[]): FoliagePoint[] {
  return batches.flatMap(({ mesh }) => {
    if (mesh.kind !== "triangle-list")
      throw new Error("Expected triangle-list foliage.");
    return [...mesh.options.positions];
  });
}
function leaves(batches: readonly FoliageBatch[]): FoliagePoint[][] {
  const points = positions(batches);
  return Array.from({ length: points.length / 24 }, (_, i) =>
    points.slice(i * 24, (i + 1) * 24),
  );
}
function sub(a: FoliagePoint, b: FoliagePoint): FoliagePoint {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: FoliagePoint, b: FoliagePoint): FoliagePoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot(a: FoliagePoint, b: FoliagePoint): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

describe("branch foliage example recipe", () => {
  it("grows paired blades forward and sideways along a horizontal branch", () => {
    const result = branchFoliageBatches(straight);
    expect(result[0]).toMatchObject({ leafletCount: 24, triangleCount: 192 });
    for (const [i, leaf] of leaves(result).entries()) {
      const direction = sub(leaf[1]!, leaf[8]!); // Blade tip and attachment corner.
      expect(direction[0]).toBeCloseTo(
        leaflet.length * Math.cos((55 * Math.PI) / 180),
        6,
      );
      expect(direction[1]).toBe(0);
      expect(Math.sign(direction[2])).toBe(i % 2 === 0 ? -1 : 1);
    }
  });

  it("distributes attachment sites by arc length and excludes authored gaps", () => {
    const branch = {
      ...straight.branches[0]!,
      path: [
        [0, 0, 0],
        [9, 0, 0],
        [9, 1, 0],
      ] as const,
      pairs: 10,
    };
    const all = leaves(
      branchFoliageBatches({ ...straight, branches: [branch] }),
    );
    expect(all.filter((leaf) => leaf[8]![0] === 9)).toHaveLength(2);
    const gapped = leaves(
      branchFoliageBatches({
        ...straight,
        branches: [{ ...branch, gaps: [[0.3, 0.55]] }],
      }),
    );
    expect(gapped.length).toBeLessThan(all.length);
    for (const leaf of gapped) {
      const base = leaf[8]!;
      const fraction = (base[0] + base[1]) / 10;
      expect(fraction < 0.3 || fraction > 0.55).toBe(true);
    }
  });

  it("replays without mutating inputs and preserves surviving geometry during thinning", () => {
    const options: BranchFoliageOptions = {
      ...straight,
      sizeVariation: 0.2,
      leafTiltDegrees: 18,
      branches: [
        { ...straight.branches[0]!, batch: 0 },
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
    const originalInput = structuredClone(options);
    const full = branchFoliageBatches(options);
    const reduced = branchFoliageBatches({
      ...options,
      branches: [
        { ...options.branches[0]!, density: [0.2, 0.6], gaps: [[0.3, 0.55]] },
        options.branches[1]!,
      ],
    });
    expect(options).toEqual(originalInput);
    expect(branchFoliageBatches(options)).toEqual(full);
    expect(branchFoliageBatches({ ...options, seed: 38 })).not.toEqual(full);
    const fullLeaves = new Set(
      leaves(full).map((leaf) => JSON.stringify(leaf)),
    );
    expect(leaves(reduced).length).toBeLessThan(leaves(full).length);
    expect(
      leaves(reduced).every((leaf) => fullLeaves.has(JSON.stringify(leaf))),
    ).toBe(true);
    expect(reduced.find((b) => b.batch === 1)).toEqual(
      full.find((b) => b.batch === 1),
    );
  });

  it("keeps Float32 leaves closed and outward through vertical, bent and reversing paths", () => {
    const result = branchFoliageBatches({
      seed: 79,
      leaflet,
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
    for (const leaf of leaves(result)) {
      expect(
        leaf.every((p) =>
          p.every((v) => Number.isFinite(v) && Math.fround(v) === v),
        ),
      ).toBe(true);
      expect(new Set(leaf.map((p) => p.join(","))).size).toBe(6);
      const mean = (axis: number): number =>
        leaf.reduce((sum, p) => sum + p[axis]!, 0) / 24;
      const center: FoliagePoint = [mean(0), mean(1), mean(2)];
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < 24; i += 3) {
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
    expect(() =>
      createTriangleListMeshAsset({ positions: positions(result) }),
    ).not.toThrow();
  });

  it("bounds candidate work while accepting the documented limits", () => {
    const base = straight.branches[0]!;
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [{ ...base, pairs: 20001 }],
      }),
    ).toThrow(/20000 candidate pairs/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [
          { ...base, pairs: 10001 },
          { ...base, pairs: 10000 },
        ],
      }),
    ).toThrow(/20000 candidate pairs/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: Array.from({ length: 1025 }, () => ({ ...base, pairs: 0 })),
      }),
    ).toThrow(/1024 branches/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [
          {
            ...base,
            path: Array.from({ length: 513 }, (_, i) => [i, 0, 0] as const),
          },
        ],
      }),
    ).toThrow(/512 points/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [
          {
            ...base,
            gaps: Array.from({ length: 513 }, () => [0.1, 0.2] as const),
          },
        ],
      }),
    ).toThrow(/512 intervals/);
    expect(
      branchFoliageBatches({
        ...straight,
        branches: [{ ...base, pairs: 20000, density: [0, 0] }],
      }),
    ).toEqual([]);
    expect(
      branchFoliageBatches({
        ...straight,
        branches: Array.from({ length: 1024 }, () => ({ ...base, pairs: 0 })),
      }),
    ).toEqual([]);
    expect(
      branchFoliageBatches({
        ...straight,
        branches: [
          {
            ...base,
            pairs: 1,
            path: Array.from(
              { length: 512 },
              (_, i) => [i / 20, 0, 0] as const,
            ),
          },
        ],
      })[0]?.leafletCount,
    ).toBe(2);
  });

  it("rejects malformed paths, dimensions and precision collapse", () => {
    const base = straight.branches[0]!;
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [
          {
            ...base,
            path: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
        ],
      }),
    ).toThrow(/distinct/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [{ ...base, density: [1, -1] }],
      }),
    ).toThrow(/density/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        leaflet: { ...leaflet, thickness: 0 },
      }),
    ).toThrow(/positive/);
    expect(() =>
      branchFoliageBatches({
        ...straight,
        branches: [
          {
            ...base,
            path: [
              [1e30, 1e30, 1e30],
              [2e30, 1e30, 1e30],
            ],
          },
        ],
      }),
    ).toThrow(/Float32 precision/);
  });

  it("preserves the existing ellipsoid helper's default GPU geometry", () => {
    // Fingerprint recorded from the original recipe before branch support.
    const legacy = foliageBatches({
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
    });
    expect(
      legacy.map((b) => [b.batch, b.leafletCount, b.triangleCount]),
    ).toEqual([
      [0, 3, 24],
      [1, 2, 16],
    ]);
    const gpuPositions = new Float32Array(positions(legacy).flat());
    expect(
      createHash("sha256")
        .update(new Uint8Array(gpuPositions.buffer))
        .digest("hex"),
    ).toBe("45da8510885ed6e1c453c0be6bcce4f80629592e587270b5d0bf468fb6d2781e");
  });
});
