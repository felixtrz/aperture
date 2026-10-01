import { describe, expect, it } from "vitest";
import {
  createPlaneMeshAsset,
  validateMeshAsset,
} from "@aperture-engine/render";

describe("subdivided plane geometry", () => {
  it("preserves the existing default plane layout and indices", () => {
    const plane = createPlaneMeshAsset();
    expect(plane).toEqual(
      createPlaneMeshAsset({ widthSegments: 1, heightSegments: 1 }),
    );
    expect(Array.from(plane.indexBuffer!.data)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(plane.vertexStreams[0]!.data)).toEqual([
      -0.5, -0.5, 0, 0, 0, 1, 0, 0, 0.5, -0.5, 0, 0, 0, 1, 1, 0, 0.5, 0.5, 0, 0,
      0, 1, 1, 1, -0.5, 0.5, 0, 0, 0, 1, 0, 1,
    ]);
  });

  it.each([
    [1, 2],
    [2, 1],
    [2, 3],
    [7, 9],
    [128, 128],
  ])(
    "builds a valid %i by %i grid with positive winding, normals and UVs",
    (widthSegments, heightSegments) => {
      const plane = createPlaneMeshAsset({
        width: 4,
        height: 2,
        widthSegments,
        heightSegments,
      });
      const stream = plane.vertexStreams[0]!;
      const vertices = stream.data as Float32Array;
      const indices = plane.indexBuffer!.data;
      expect(stream.vertexCount).toBe(
        (widthSegments + 1) * (heightSegments + 1),
      );
      expect(indices.length).toBe(widthSegments * heightSegments * 6);
      expect(validateMeshAsset(plane)).toEqual({
        valid: true,
        diagnostics: [],
      });
      for (let i = 0; i < stream.vertexCount; i++) {
        expect(Array.from(vertices.slice(i * 8 + 3, i * 8 + 6))).toEqual([
          0, 0, 1,
        ]);
        const u = vertices[i * 8 + 6]!;
        const v = vertices[i * 8 + 7]!;
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(vertices[i * 8]).toBeCloseTo(u * 4 - 2, 5);
        expect(vertices[i * 8 + 1]).toBeCloseTo(v * 2 - 1, 5);
      }
      let area = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i]! * 8;
        const b = indices[i + 1]! * 8;
        const c = indices[i + 2]! * 8;
        const cross =
          (vertices[b]! - vertices[a]!) *
            (vertices[c + 1]! - vertices[a + 1]!) -
          (vertices[b + 1]! - vertices[a + 1]!) * (vertices[c]! - vertices[a]!);
        expect(cross).toBeGreaterThan(0);
        area += cross / 2;
      }
      expect(area).toBeCloseTo(8, 5);
      expect(plane.localAabb).toEqual({ min: [-2, -1, 0], max: [2, 1, 0] });
      expect(plane.localSphere).toEqual({
        center: [0, 0, 0],
        radius: Math.sqrt(5),
      });
    },
  );

  it.each([NaN, Infinity, -Infinity, -3, 0])(
    "falls back to one cell for invalid count %s",
    (value) => {
      expect(
        createPlaneMeshAsset({ widthSegments: value, heightSegments: value }),
      ).toEqual(createPlaneMeshAsset());
    },
  );

  it("floors fractional cells and caps allocation at 128 cells per axis", () => {
    expect(
      createPlaneMeshAsset({ widthSegments: 2.9, heightSegments: 3.7 }),
    ).toEqual(createPlaneMeshAsset({ widthSegments: 2, heightSegments: 3 }));
    const capped = createPlaneMeshAsset({
      widthSegments: 1e12,
      heightSegments: 1e12,
    });
    expect(capped.vertexStreams[0]!.vertexCount).toBe(129 * 129);
    expect(capped.indexBuffer!.data.length).toBe(128 * 128 * 6);
  });

  it("normalizes each axis independently", () => {
    expect(
      createPlaneMeshAsset({ widthSegments: Infinity, heightSegments: 3.9 }),
    ).toEqual(createPlaneMeshAsset({ widthSegments: 1, heightSegments: 3 }));
    expect(
      createPlaneMeshAsset({ widthSegments: 1e12, heightSegments: NaN }),
    ).toEqual(createPlaneMeshAsset({ widthSegments: 128, heightSegments: 1 }));
  });

  it("addresses every vertex at the maximum size without uint16 overflow", () => {
    const plane = createPlaneMeshAsset({
      widthSegments: 128,
      heightSegments: 128,
    });
    const indices = plane.indexBuffer!.data;
    const referenced = new Set(indices);
    expect(plane.indexBuffer!.format).toBe("uint16");
    expect(indices).toBeInstanceOf(Uint16Array);
    expect(referenced.size).toBe(129 * 129);
    expect(Math.min(...referenced)).toBe(0);
    expect(Math.max(...referenced)).toBe(129 * 129 - 1);
    expect(Array.from(indices.slice(-6))).toEqual([
      16510, 16511, 16640, 16510, 16640, 16639,
    ]);
  });

  it("keeps fractional-size corners and bounds consistent with the default plane", () => {
    const options = { label: "fractional plane", width: 0.3, height: 0.7 };
    const singleCell = createPlaneMeshAsset(options);
    const grid = createPlaneMeshAsset({
      ...options,
      widthSegments: 3,
      heightSegments: 7,
    });
    const gridVertices = grid.vertexStreams[0]!.data as Float32Array;
    const defaultVertices = singleCell.vertexStreams[0]!.data as Float32Array;
    const cornerIndices = [0, 3, 31, 28];
    for (const [index, gridIndex] of cornerIndices.entries()) {
      expect(gridVertices.slice(gridIndex * 8, gridIndex * 8 + 8)).toEqual(
        defaultVertices.slice(index * 8, index * 8 + 8),
      );
    }
    expect(grid.localAabb).toEqual(singleCell.localAabb);
    expect(grid.localSphere).toEqual(singleCell.localSphere);
    expect(grid.label).toBe(options.label);
  });
});
