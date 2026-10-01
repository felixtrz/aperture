import { describe, expect, it } from "vitest";
import {
  createApertureSystemContext,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import {
  AssetRegistry,
  createWorld,
  createMeshHandle,
} from "@aperture-engine/simulation";
import { createPlaneMeshAsset, type MeshAsset } from "@aperture-engine/render";

describe("plane descriptor subdivisions", () => {
  it("honors the declared subdivisions option when spawning a plane", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    context.spawn.mesh({
      key: "terrain",
      mesh: mesh.plane({ size: [4, 2], subdivisions: 3 }),
      material: material.standard(),
    });
    const geometry = registry.get<"mesh", MeshAsset>(
      createMeshHandle("terrain.mesh"),
    )?.asset;
    expect(geometry?.vertexStreams[0]?.vertexCount).toBe(16);
    expect(geometry?.indexBuffer?.data.length).toBe(54);
  });

  it.each([
    [undefined, 1],
    [NaN, 1],
    [Infinity, 1],
    [-Infinity, 1],
    [-3, 1],
    [0, 1],
    [0.5, 1],
    [2.9, 2],
    [1e12, 128],
  ] as const)(
    "normalizes subdivision value %s to %i cells",
    (subdivisions, cells) => {
      const registry = new AssetRegistry();
      const context = createApertureSystemContext({
        world: createWorld(),
        assetsRegistry: registry,
      });
      context.spawn.mesh({
        key: "plane",
        mesh: mesh.plane({
          size: 2,
          ...(subdivisions === undefined ? {} : { subdivisions }),
        }),
        material: material.standard(),
      });
      const geometry = registry.get<"mesh", MeshAsset>(
        createMeshHandle("plane.mesh"),
      )?.asset;
      expect(geometry).toEqual(
        createPlaneMeshAsset({
          width: 2,
          height: 2,
          widthSegments: cells,
          heightSegments: cells,
        }),
      );
    },
  );
});
