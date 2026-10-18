import { describe, expect, it } from "vitest";
import {
  createTriangleListMeshAsset,
  loftTriangleListOptions,
  type LoftMeshOptions,
} from "@aperture-engine/render";
import { mesh } from "@aperture-engine/app/systems";

const sections: LoftMeshOptions["sections"] = [
  [
    [-1, 0, -1],
    [1, 0, -1],
    [1, 0, 1],
    [-1, 0, 1],
  ],
  [
    [-0.6, 1, -0.8],
    [0.6, 1, -0.8],
    [0.6, 1, 0.8],
    [-0.6, 1, 0.8],
  ],
];
describe("corresponding section lofts", () => {
  it("preserves section bounds, emits outward flat normals and supports reverse winding", () => {
    const options = loftTriangleListOptions({ sections });
    const asset = createTriangleListMeshAsset(options);
    expect(asset.localAabb).toEqual({ min: [-1, 0, -1], max: [1, 1, 1] });
    expect(asset.vertexStreams[0]!.vertexCount).toBe(24);
    const data = asset.vertexStreams[0]!.data;
    expect(data[5]).toBeLessThan(0); // front (-Z), not inward
    const reversed = createTriangleListMeshAsset(
      loftTriangleListOptions({ sections, flipWinding: true }),
    );
    expect(reversed.vertexStreams[0]!.data[5]).toBeGreaterThan(0);
    expect(mesh.loft({ sections })).toMatchObject({ kind: "triangle-list" });
  });
  it("leaves open strips open and owns its input positions", () => {
    const mutable = sections.map((section) =>
      section.map((p) => [...p] as [number, number, number]),
    );
    const options = loftTriangleListOptions({
      sections: mutable,
      closed: false,
    });
    expect(options.indices).toHaveLength(18);
    mutable[0]![0]![0] = 99;
    expect(options.positions[0]![0]).toBe(-1);
  });
  it("rejects mismatched sections, invalid points and collapsed surface cells", () => {
    expect(() => loftTriangleListOptions({ sections: [sections[0]!] })).toThrow(
      "2 through 256",
    );
    expect(() =>
      loftTriangleListOptions({
        sections: [sections[0]!, sections[1]!.slice(1)],
      }),
    ).toThrow("sections[1]");
    expect(() =>
      loftTriangleListOptions({
        sections: [sections[0]!, [[NaN, 1, 0], ...sections[1]!.slice(1)]],
      }),
    ).toThrow("sections[1][0]");
    expect(() =>
      createTriangleListMeshAsset(
        loftTriangleListOptions({ sections: [sections[0]!, sections[0]!] }),
      ),
    ).toThrow();
  });
});
