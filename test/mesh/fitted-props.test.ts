import { describe, expect, it } from "vitest";
import {
  createPolygonMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  bridgeProfiles,
  windowPanel,
  type Point,
} from "../../examples/fitted-props/src/panels.ts";
import { instrumentHousingSurfaces } from "../../examples/fitted-props/src/housing.ts";
import {
  archProfile,
  cabinProfile,
  cabinSections,
  utilityVehicleSurfaces,
  vehicleDimensions,
} from "../../examples/fitted-props/src/vehicle.ts";

function triangles(asset: MeshAsset): Point[][] {
  const data = asset.vertexStreams[0]!.data as Float32Array,
    indices = asset.indexBuffer!.data;
  const output: Point[][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    output.push(
      Array.from(
        indices.slice(i, i + 3),
        (index) =>
          Array.from(data.slice(index * 8, index * 8 + 3)) as unknown as Point,
      ),
    );
  }
  return output;
}

function checkClosedShell(assets: MeshAsset[]): void {
  const edges = new Map<string, { count: number; direction: number }>();
  let volume = 0;
  for (const asset of assets) {
    expect(validateMeshAsset(asset).valid).toBe(true);
    const data = asset.vertexStreams[0]!.data as Float32Array,
      indices = asset.indexBuffer!.data;
    for (const [i, [a, b, c]] of triangles(asset).entries()) {
      const ab = b!.map((v, axis) => v - a![axis]!),
        ac = c!.map((v, axis) => v - a![axis]!);
      const cross = [
        ab[1]! * ac[2]! - ab[2]! * ac[1]!,
        ab[2]! * ac[0]! - ab[0]! * ac[2]!,
        ab[0]! * ac[1]! - ab[1]! * ac[0]!,
      ];
      const area = Math.hypot(...cross);
      expect(area).toBeGreaterThan(1e-8);
      for (const index of indices.slice(i * 3, i * 3 + 3)) {
        const n = data.slice(index * 8 + 3, index * 8 + 6);
        expect(Math.hypot(...n)).toBeCloseTo(1, 5);
        expect(
          cross.reduce((sum, value, axis) => sum + value * n[axis]!, 0) / area,
        ).toBeCloseTo(1, 5);
      }
      volume +=
        a![0] * (b![1] * c![2] - b![2] * c![1]) +
        a![1] * (b![2] * c![0] - b![0] * c![2]) +
        a![2] * (b![0] * c![1] - b![1] * c![0]);
      const corners = [a!, b!, c!].map((p) => p.join(","));
      for (let e = 0; e < 3; e++) {
        const start = corners[e]!,
          end = corners[(e + 1) % 3]!;
        const key = start < end ? `${start}|${end}` : `${end}|${start}`;
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count++;
        edge.direction += start < end ? 1 : -1;
        edges.set(key, edge);
      }
    }
  }
  expect(volume / 6).toBeGreaterThan(0);
  for (const [key, edge] of edges) {
    expect(edge.count, `unmatched or duplicated edge ${key}`).toBe(2);
    expect(edge.direction, `inconsistent winding at ${key}`).toBe(0);
  }
}

function rayX(triangle: Point[], y: number, z: number): number | undefined {
  const [a, b, c] = triangle as [Point, Point, Point];
  const denominator =
    (b[2] - c[2]) * (a[1] - c[1]) + (c[1] - b[1]) * (a[2] - c[2]);
  if (Math.abs(denominator) < 1e-10) return undefined;
  const u =
    ((b[2] - c[2]) * (y - c[1]) + (c[1] - b[1]) * (z - c[2])) / denominator;
  const v =
    ((c[2] - a[2]) * (y - c[1]) + (a[1] - c[1]) * (z - c[2])) / denominator;
  return u >= 0 && v >= 0 && u + v <= 1
    ? u * a[0] + v * b[0] + (1 - u - v) * c[0]
    : undefined;
}

describe("fitted profile prop recipes", () => {
  it("partitions the utility shell into closed, consistently wound paint, glazing and recessed wells", () => {
    checkClosedShell(
      Object.values(utilityVehicleSurfaces()).map(createPolygonMeshAsset),
    );
  });

  it("uses the same panel operations for a closed nonvehicle housing", () => {
    checkClosedShell(
      Object.values(instrumentHousingSurfaces()).map(createPolygonMeshAsset),
    );
  });

  it("owns each exact glass boundary once and reserves a real hood beyond the cabin", () => {
    const { cabin, glazing } = utilityVehicleSurfaces();
    const holes = cabin.faces.flatMap((face) => face.holes ?? []);
    expect(holes).toHaveLength(5);
    for (let i = 0; i < holes.length; i++)
      expect(glazing.faces[i]!.outline).toBe(holes[i]);
    const rear = cabinProfile(cabinSections[1]!),
      front = cabinProfile(cabinSections[3]!);
    expect(front[0]![0]).toBeLessThan(rear[0]![0]);
    expect(front[2]![0]).toBeLessThan(front[0]![0]);
    expect(front[2]![1]).toBeLessThan(rear[2]![1]);
    expect(1.78 - cabinSections.at(-1)!.z).toBeGreaterThan(0.6);
  });

  it("leaves four wheel cavities open with tire clearance, reveal depth and visible inner walls", () => {
    const d = vehicleDimensions;
    const geometry = Object.values(utilityVehicleSurfaces()).flatMap(
      (options) => triangles(createPolygonMeshAsset(options)),
    );
    expect(
      d.openingRadius * Math.cos(Math.PI / (2 * d.archSegments)),
    ).toBeGreaterThan(d.wheelRadius + 0.04);
    expect(d.wheelX - d.wheelHalfDepth).toBeGreaterThan(d.wellBack);
    for (const sign of [-1, 1])
      for (const axle of d.axles) {
        for (let i = 1; i < 12; i++) {
          const angle = (i * Math.PI) / 12;
          const y = d.wheelY + Math.sin(angle) * d.wheelRadius;
          const z = axle + Math.cos(angle) * d.wheelRadius;
          const hits = geometry
            .map((triangle) => rayX(triangle, y, z))
            .filter((x): x is number => x !== undefined);
          expect(Math.max(...hits.map((x) => sign * x))).toBeCloseTo(
            d.wellBack,
            5,
          );
        }
        const outer = archProfile(sign * d.sideWidth, axle, d.lipRadius);
        const lip = archProfile(sign * d.lipX, axle, d.openingRadius);
        expect(outer).toHaveLength(lip.length);
        expect(Math.abs(lip[0]![0]) - Math.abs(outer[0]![0])).toBeCloseTo(
          0.025,
        );
      }
  });

  it("splits bent strips into planar faces and rejects windows spanning a bend with a useful location", () => {
    const a: Point[] = [
        [0, 0, 0],
        [1, 0, 0],
      ],
      b: Point[] = [
        [0, 1, 0],
        [1, 1, 0.2],
      ];
    const faces = bridgeProfiles(a, b);
    expect(faces).toHaveLength(2);
    expect(validateMeshAsset(createPolygonMeshAsset({ faces })).valid).toBe(
      true,
    );
    expect(() =>
      windowPanel([a[0]!, a[1]!, b[1]!, b[0]!], undefined, "section 2, cell 4"),
    ).toThrow(/section 2, cell 4:.*planar quad/);
    expect(() => bridgeProfiles(a, [b[0]!], false, "sections 2/3")).toThrow(
      /sections 2\/3:.*matching corner counts/,
    );
    expect(() =>
      windowPanel(
        [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        [0, 0.1, 0.9, 0.9],
      ),
    ).toThrow(/strictly inside/);
  });

  it("rejects concave panel insets before their glass can escape the boundary", () => {
    expect(() =>
      windowPanel(
        [
          [0, 0, 0],
          [2, 0, 0],
          [0.2, 0.2, 0],
          [0, 2, 0],
        ],
        undefined,
        "section 3, cell 1",
      ),
    ).toThrow(/section 3, cell 1:.*strictly convex planar quad/);
  });
});
