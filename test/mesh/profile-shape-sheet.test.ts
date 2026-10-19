import { describe, expect, it } from "vitest";
import {
  createPolygonMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  profileShell,
  type ProfileShape,
} from "../../examples/fitted-props/src/profile-shell.ts";
import {
  shapeStudies,
  studyShape,
  studyWheels,
  type ShapeStudy,
  type ShapeVariant,
} from "../../examples/fitted-props/src/shape-sheet.ts";
import type { Point } from "../../examples/fitted-props/src/panels.ts";

type Triangle = readonly [Point, Point, Point];
const sub = (a: Point, b: Point): Point => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dot = (a: Point, b: Point): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function triangles(asset: MeshAsset): Triangle[] {
  const data = asset.vertexStreams[0]!.data as Float32Array;
  const indices = asset.indexBuffer!.data;
  return Array.from(
    { length: indices.length / 3 },
    (_, face) =>
      Array.from(
        indices.slice(face * 3, face * 3 + 3),
        (index) =>
          Array.from(data.slice(index * 8, index * 8 + 3)) as unknown as Point,
      ) as unknown as Triangle,
  );
}

function assets(shape: ProfileShape): MeshAsset[] {
  return Object.values(profileShell(shape))
    .filter((part) => part.faces.length)
    .map(createPolygonMeshAsset);
}

/** Independent tests on the emitted Float32 triangle soup, across material partitions. */
function closedSolid(meshes: MeshAsset[]): void {
  const edges = new Map<string, { count: number; direction: number }>();
  let volume = 0;
  for (const asset of meshes) {
    expect(validateMeshAsset(asset).valid).toBe(true);
    const data = asset.vertexStreams[0]!.data as Float32Array;
    const indices = asset.indexBuffer!.data;
    for (const [face, tri] of triangles(asset).entries()) {
      const normal = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]));
      expect(Math.hypot(...normal)).toBeGreaterThan(0);
      volume += dot(tri[0], cross(tri[1], tri[2])) / 6;
      for (const index of indices.slice(face * 3, face * 3 + 3)) {
        const n = Array.from(
          data.slice(index * 8 + 3, index * 8 + 6),
        ) as unknown as Point;
        expect(Math.hypot(...n)).toBeCloseTo(1, 5);
        expect(dot(n, normal) / Math.hypot(...normal)).toBeCloseTo(1, 5);
      }
      const corners = tri.map((p) => p.join(","));
      for (let i = 0; i < 3; i++) {
        const a = corners[i]!,
          b = corners[(i + 1) % 3]!;
        const key = [a, b].sort().join("|");
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count++;
        edge.direction += a < b ? 1 : -1;
        edges.set(key, edge);
      }
    }
  }
  expect(volume).toBeGreaterThan(0);
  for (const [key, edge] of edges) {
    expect(edge.count, `unmatched/duplicated material boundary ${key}`).toBe(2);
    expect(edge.direction, `inconsistent winding ${key}`).toBe(0);
  }
}

function ray(
  origin: Point,
  direction: Point,
  tri: Triangle,
): number | undefined {
  const e1 = sub(tri[1], tri[0]),
    e2 = sub(tri[2], tri[0]);
  const h = cross(direction, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-10) return undefined;
  const s = sub(origin, tri[0]),
    u = dot(s, h) / det;
  const q = cross(s, e1),
    v = dot(direction, q) / det;
  const distance = dot(e2, q) / det;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6 && distance >= 0
    ? distance
    : undefined;
}

describe("generic profile shape sheet", () => {
  for (const study of ["vehicle", "housing"] as const)
    for (const variant of ["boxy", "shaped"] as const)
      it(`${study}/${variant} remains one outward closed material shell at multiple sizes`, () => {
        for (const scale of [0.05, 1, 20]) {
          const source = studyShape(study, variant);
          const shape = {
            ...source,
            baseY: source.baseY * scale,
            sections: source.sections.map((s) => ({
              z: s.z * scale,
              halfWidth: s.halfWidth * scale,
              shoulderY: s.shoulderY * scale,
              crownY: s.crownY * scale,
              crownHalfWidth: s.crownHalfWidth * scale,
            })),
          };
          closedSolid(assets(shape));
        }
      });

  it("leaves actual paint openings at the exact side and sloped-top pane boundaries", () => {
    for (const study of ["vehicle", "housing"] as const) {
      const parts = profileShell(shapeStudies[study]);
      const { glazing, ...paint } = parts;
      const holes = Object.values(paint).flatMap((part) =>
        part.faces.flatMap((face) => face.holes ?? []),
      );
      expect(holes.length).toBe(shapeStudies[study].windows!.length);
      const painted = Object.values(paint).flatMap((part) =>
        triangles(createPolygonMeshAsset(part)),
      );
      const panes = triangles(createPolygonMeshAsset(glazing));
      for (const pane of glazing.faces) {
        expect(holes.filter((hole) => hole === pane.outline)).toHaveLength(1);
        const center = [0, 1, 2].map((axis) =>
          pane.outline.reduce(
            (sum, p) => sum + p[axis]! / pane.outline.length,
            0,
          ),
        ) as unknown as Point;
        const n = cross(
          sub(pane.outline[1]!, pane.outline[0]!),
          sub(pane.outline[2]!, pane.outline[0]!),
        );
        const unit = n.map((v) => v / Math.hypot(...n)) as unknown as Point;
        const origin = center.map(
          (v, axis) => v + unit[axis]! * 0.03,
        ) as unknown as Point;
        const direction = unit.map((v) => -v) as unknown as Point;
        expect(
          painted
            .map((t) => ray(origin, direction, t))
            .filter((t) => t !== undefined && t < 0.06),
        ).toHaveLength(0);
        const hits = panes
          .map((t) => ray(origin, direction, t))
          .filter((t): t is number => t !== undefined);
        expect(Math.min(...hits)).toBeCloseTo(0.03, 5);
      }
    }
  });

  it("changes the silhouette inside the same envelope instead of merely adding triangles", () => {
    const points = (study: ShapeStudy, variant: ShapeVariant) =>
      assets(studyShape(study, variant)).flatMap((a) => triangles(a).flat());
    for (const study of ["vehicle", "housing"] as const) {
      const boxy = points(study, "boxy"),
        shaped = points(study, "shaped");
      for (const axis of [0, 1, 2]) {
        expect(Math.min(...boxy.map((p) => p[axis]!))).toBeCloseTo(
          Math.min(...shaped.map((p) => p[axis]!)),
          5,
        );
        expect(Math.max(...boxy.map((p) => p[axis]!))).toBeCloseTo(
          Math.max(...shaped.map((p) => p[axis]!)),
          5,
        );
      }
      const nose = Math.max(...shaped.map((p) => p[2]));
      const topAtNose = (ps: Point[]) =>
        Math.max(...ps.filter((p) => p[2] === nose).map((p) => p[1]));
      expect(topAtNose(boxy) - topAtNose(shaped)).toBeGreaterThan(0.4);
    }
    const vehicle = points("vehicle", "shaped");
    expect(Math.min(...vehicle.map((p) => p[1]))).toBeGreaterThan(
      studyWheels.radius * 2 + 0.05,
    );
    expect(
      (2 * studyWheels.radius) /
        (Math.max(...vehicle.map((p) => p[2])) -
          Math.min(...vehicle.map((p) => p[2]))),
    ).toBeCloseTo(0.1578947, 6);
  });

  it("preserves edited section measurements without mutating caller data", () => {
    const shape = structuredClone(shapeStudies.housing);
    const sections = shape.sections.map((s) => ({
      ...s,
      halfWidth: s.halfWidth * 1.25,
      crownHalfWidth: s.crownHalfWidth * 1.15,
    }));
    const changed = { ...shape, sections };
    const before = JSON.stringify(changed);
    const built = assets(changed);
    closedSolid(built);
    const vertices = built.flatMap((a) => triangles(a).flat());
    for (const section of sections) {
      expect(
        vertices.some(
          (p) =>
            p[0] === Math.fround(section.halfWidth) &&
            p[1] === Math.fround(shape.baseY) &&
            p[2] === Math.fround(section.z),
        ),
      ).toBe(true);
      expect(
        vertices.some(
          (p) =>
            p[0] === Math.fround(section.crownHalfWidth) &&
            p[1] === Math.fround(section.crownY) &&
            p[2] === Math.fround(section.z),
        ),
      ).toBe(true);
    }
    expect(JSON.stringify(changed)).toBe(before);
  });

  it("isolates edited study sections, window selections and bounds from later controls", () => {
    const canonical = structuredClone(shapeStudies.housing);
    try {
      const shaped = studyShape("housing", "shaped");
      const boxy = studyShape("housing", "boxy");
      Reflect.set(shaped.sections[0]!, "z", -2);
      Reflect.set(shaped.windows![0]!, "section", 1);
      Reflect.set(boxy.windows![0]!.bounds!, "0", 0.25);
      expect(shapeStudies.housing).toEqual(canonical);
      expect(studyShape("housing", "shaped")).toEqual(canonical);
      expect(studyShape("housing", "boxy").windows).toEqual(canonical.windows);
      expect(boxy.windows![0]!.section).toBe(0);
      expect(shaped.windows![0]!.bounds).toEqual(canonical.windows![0]!.bounds);
      closedSolid(assets(studyShape("housing", "shaped")));
    } finally {
      // Keep this regression isolated even if a future change reintroduces sharing.
      shapeStudies.housing = canonical;
    }
  });

  it("validates all required section coordinates while allowing caller labels", () => {
    const source = shapeStudies.housing;
    const labeled = {
      ...source,
      sections: source.sections.map((section, index) => ({
        ...section,
        label: index === 0 ? "rear" : "front",
      })),
    };
    closedSolid(assets(labeled));
    for (const field of [
      "z",
      "halfWidth",
      "shoulderY",
      "crownY",
      "crownHalfWidth",
    ]) {
      for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
        const shape = structuredClone(source);
        if (value === undefined)
          Reflect.deleteProperty(shape.sections[0]!, field);
        else Reflect.set(shape.sections[0]!, field, value);
        expect(() => profileShell({ ...shape, windows: [] })).toThrow(
          /profile section 0: finite dimensions/,
        );
      }
    }
  });

  it.each(["toString", "constructor", "__proto__", "back"])(
    "rejects unsupported window band %s instead of silently omitting its pane",
    (band) => {
      const shape = structuredClone(shapeStudies.housing);
      Reflect.set(shape.windows![0]!, "band", band);
      expect(() => profileShell(shape)).toThrow(/valid section\/band/);
    },
  );

  it("rejects collapsed profiles and repeated or unavailable window cells before meshing", () => {
    const shape = shapeStudies.housing;
    expect(() =>
      profileShell({
        ...shape,
        sections: [shape.sections[0]!, shape.sections[0]!],
      }),
    ).toThrow(/increasing z/);
    expect(() =>
      profileShell({
        ...shape,
        sections: shape.sections.map((s) => ({ ...s, shoulderY: s.crownY })),
      }),
    ).toThrow(/base < shoulder < crown/);
    expect(() =>
      profileShell({ ...shape, windows: [{ section: 2, band: "top" }] }),
    ).toThrow(/valid section\/band/);
    expect(() =>
      profileShell({
        ...shape,
        windows: [...shape.windows!, ...shape.windows!],
      }),
    ).toThrow(/unique/);
  });
});
