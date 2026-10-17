import { describe, expect, it } from "vitest";
import {
  createPolygonMeshAsset,
  validateMeshAsset,
} from "@aperture-engine/render";
import { fittedCarSurfaces } from "../../examples/procedural-car/src/car.js";

describe("fitted car surface recipe", () => {
  it("partitions a closed, consistently wound shell between paint and glazing", () => {
    const model = fittedCarSurfaces();
    const edges = new Map<string, { count: number; direction: number }>();
    for (const options of [model.body, model.glazing]) {
      const asset = createPolygonMeshAsset(options);
      expect(validateMeshAsset(asset).valid).toBe(true);
      const data = asset.vertexStreams[0]!.data as Float32Array,
        indices = asset.indexBuffer!.data;
      const point = (i: number) =>
        Array.from(data.slice(i * 8, i * 8 + 3)).join(",");
      for (let i = 0; i < indices.length; i += 3)
        for (let e = 0; e < 3; e++) {
          const a = point(indices[i + e]!),
            b = point(indices[i + ((e + 1) % 3)]!);
          expect(a).not.toBe(b);
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          const entry = edges.get(key) ?? { count: 0, direction: 0 };
          entry.count++;
          entry.direction += a < b ? 1 : -1;
          edges.set(key, entry);
        }
    }
    for (const [key, edge] of edges) {
      expect(edge.count, key).toBe(2);
      expect(edge.direction, key).toBe(0);
    }
  });
  it("uses every window opening exactly once for glass with no offset or backing panel", () => {
    const { body, glazing } = fittedCarSurfaces();
    const openings = body.faces.slice(11).flatMap((f) => f.holes ?? []);
    expect(openings).toHaveLength(6);
    expect(glazing.faces.map((f) => f.outline)).toEqual(openings);
    expect(body.faces).toHaveLength(15);
    const positions = body.faces.flatMap((f) => f.outline);
    const roof = positions.filter((p) => p[1] === 1.37);
    expect(roof.length).toBeGreaterThan(0);
    expect(Math.max(...roof.map((p) => Math.abs(p[0])))).toBe(0.46);
    expect(
      Math.max(
        ...positions.filter((p) => p[1] === 0.75).map((p) => Math.abs(p[0])),
      ),
    ).toBe(0.64);
  });
});
