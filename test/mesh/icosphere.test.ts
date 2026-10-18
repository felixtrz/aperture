import { expect, it } from "vitest";
import {
  icosphereTriangleListOptions,
  createTriangleListMeshAsset,
} from "@aperture-engine/render";
import { mesh } from "@aperture-engine/app/systems";

it.each([0, 1, 2, 3, 4])(
  "creates a closed outward geodesic surface at subdivision %i",
  (subdivisions) => {
    const geometry = icosphereTriangleListOptions({
      radius: 2.5,
      subdivisions,
    });
    expect(geometry.positions).toHaveLength(10 * 4 ** subdivisions + 2);
    expect(geometry.indices).toHaveLength(60 * 4 ** subdivisions);
    for (const p of geometry.positions)
      expect(Math.hypot(...p)).toBeCloseTo(2.5, 12);
    const edges = new Map<string, number>();
    const directed = new Set<string>();
    for (let i = 0; i < geometry.indices!.length; i += 3) {
      const ids = Array.from(geometry.indices!.slice(i, i + 3));
      for (let j = 0; j < 3; j++) {
        const a = ids[j]!,
          b = ids[(j + 1) % 3]!,
          key = [Math.min(a, b), Math.max(a, b)].join("/");
        edges.set(key, (edges.get(key) ?? 0) + 1);
        expect(directed.has(`${a}/${b}`)).toBe(false);
        directed.add(`${a}/${b}`);
      }
    }
    expect(new Set(edges.values())).toEqual(new Set([2]));
    const asset = createTriangleListMeshAsset(geometry),
      stream = asset.vertexStreams[0]!;
    const stride = stream.arrayStride / 4;
    for (let i = 0; i < stream.data.length; i += stride) {
      const p = stream.data.slice(i, i + 3),
        n = stream.data.slice(i + 3, i + 6);
      expect(p[0]! * n[0]! + p[1]! * n[1]! + p[2]! * n[2]!).toBeGreaterThan(0);
      expect(Math.hypot(...n)).toBeCloseTo(1, 5);
    }
  },
);

it("exposes deterministic portable flat-shaded geometry without mutating inputs", () => {
  const input = Object.freeze({ radius: 1.5, subdivisions: 1, label: "crown" });
  const a = mesh.icosphere(input),
    b = mesh.icosphere(input);
  expect(a).toEqual(b);
  expect(a).toMatchObject({
    kind: "triangle-list",
    options: { label: "crown" },
  });
  const generated = icosphereTriangleListOptions();
  expect(generated.indices).toHaveLength(240);
  expect(generated.normals).toBeUndefined();
});

it("rejects invalid radii and subdivision budgets instead of silently clamping them", () => {
  for (const radius of [
    0,
    -1,
    NaN,
    Infinity,
    Number.MAX_VALUE,
    Number.MIN_VALUE,
    null,
    "1",
  ]) {
    expect(() =>
      icosphereTriangleListOptions({ radius: radius as number }),
    ).toThrow("radius");
  }
  for (const subdivisions of [-1, 5, 1.5, NaN, Infinity, null, "1"]) {
    expect(() =>
      icosphereTriangleListOptions({ subdivisions: subdivisions as number }),
    ).toThrow("subdivisions");
  }
  expect(() => icosphereTriangleListOptions(null!)).toThrow("options object");
});
