import { describe, expect, it } from "vitest";
import {
  createApertureSystemContext,
  createMeshAccess,
} from "@aperture-engine/app/systems";
import {
  createBoxMeshAsset,
  createPlaneMeshAsset,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  assetHandleKey,
  createMeshHandle,
  createWorld,
} from "@aperture-engine/simulation";

describe("Aperture system mesh access", () => {
  it("registers a dynamic mesh with an initial ready asset", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);

    const mesh = meshes.dynamic("dynamic.quad", {
      label: "Dynamic Quad",
      initial: createPlaneMeshAsset({ label: "Initial Quad" }),
    });
    const entry = registry.get<"mesh">(mesh.handle);

    expect(mesh.key).toBe(assetHandleKey(createMeshHandle("dynamic.quad")));
    expect(entry?.status).toBe("ready");
    expect(entry?.version).toBe(1);
    expect(mesh.get()?.label).toBe("Initial Quad");
  });

  it("publishes new mesh versions for renderer re-upload", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.box", {
      initial: createBoxMeshAsset({ label: "Box 1" }),
    });

    const result = mesh.publish(createBoxMeshAsset({ label: "Box 2" }));

    expect(result.key).toBe(mesh.key);
    expect(result.version).toBe(2);
    expect(meshes.get(mesh.handle)?.label).toBe("Box 2");
  });

  it("installs mesh access on the system context", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });

    const result = context.meshes.publish(
      "context.mesh",
      createPlaneMeshAsset({ label: "Context Plane" }),
    );

    expect(result.version).toBe(1);
    expect(registry.get<"mesh">(createMeshHandle("context.mesh"))?.status).toBe(
      "ready",
    );
  });
});
