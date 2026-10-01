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
import { type MeshAsset } from "@aperture-engine/render";

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
});
