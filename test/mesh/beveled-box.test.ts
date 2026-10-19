import { expect, it } from "vitest";
import {
  beveledBoxTriangleListOptions,
  createTriangleListMeshAsset,
} from "@aperture-engine/render";
import { mesh } from "@aperture-engine/app/systems";

it("builds a closed outward chamfered solid with exact bounds and shared edges", () => {
  const options = beveledBoxTriangleListOptions({
    size: [4, 2, 3],
    bevel: 0.2,
  });
  expect(options.positions).toHaveLength(24);
  expect(options.indices).toHaveLength(44 * 3);
  const edges = new Map<string, number>();
  for (let i = 0; i < options.indices!.length; i += 3) {
    const ids = options.indices!.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const a = ids[j]!,
        b = ids[(j + 1) % 3]!;
      const key = [Math.min(a, b), Math.max(a, b)].join(",");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect(new Set(edges.values())).toEqual(new Set([2]));
  const asset = createTriangleListMeshAsset(options);
  expect(asset.localAabb).toEqual({ min: [-2, -1, -1.5], max: [2, 1, 1.5] });
  const stream = asset.vertexStreams[0]!;
  // Triangle-list's first six floats are position and normal. Every outward
  // plane of this centered convex solid has a positive normal dot position.
  for (let i = 0; i < stream.data.length; i += stream.arrayStride / 4) {
    expect(
      stream.data[i]! * stream.data[i + 3]! +
        stream.data[i + 1]! * stream.data[i + 4]! +
        stream.data[i + 2]! * stream.data[i + 5]!,
    ).toBeGreaterThan(0);
  }
  expect(mesh.beveledBox({ size: [4, 2, 3], bevel: 0.2 })).toMatchObject({
    kind: "triangle-list",
  });
});

it("rejects invalid or collapsing dimensions and chamfers", () => {
  for (const bevel of [0, -1, NaN, Infinity, 0.5, 1])
    expect(() => beveledBoxTriangleListOptions({ bevel })).toThrow("bevel");
  expect(() => beveledBoxTriangleListOptions({ size: [1, 0, 2] })).toThrow(
    "size",
  );
  expect(() =>
    beveledBoxTriangleListOptions({ size: [1, Infinity, 2] }),
  ).toThrow("size");
  expect(
    createTriangleListMeshAsset(beveledBoxTriangleListOptions()).localAabb,
  ).toEqual({ min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] });
});

it.each(["render", "facade"])(
  "%s reports the supplied thin-box bevel and its exclusive upper limit",
  (route) => {
    const make =
      route === "render" ? beveledBoxTriangleListOptions : mesh.beveledBox;
    for (const bevel of [0.025, 0.0125]) {
      expect(() => make({ size: [1, 0.2, 0.025], bevel })).toThrow(
        `Received bevel ${bevel} for size [1, 0.2, 0.025]; require 0 < bevel < 0.0125.`,
      );
    }
    expect(() => make({ size: [1, 0.2, 0.025], bevel: 0.01 })).not.toThrow();
  },
);

it("reports an invalid bevel type without invoking author coercion hooks", () => {
  const bevel = {
    toString(): never {
      throw new Error("unexpected coercion");
    },
  } as unknown as number;
  expect(() => beveledBoxTriangleListOptions({ bevel })).toThrow(
    "Received bevel <object> for size [1, 1, 1]; require 0 < bevel < 0.5.",
  );
});
