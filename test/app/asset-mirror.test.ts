import { describe, expect, it } from "vitest";
import { AssetRegistry, createMeshHandle } from "@aperture-engine/simulation";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "../../packages/app/src/asset-mirror.js";

describe("generated app source asset mirroring", () => {
  it("serializes only asset entries that changed since the last snapshot", () => {
    const registry = new AssetRegistry();
    const state = createSourceAssetSerializationState();
    const mesh = createMeshHandle("cube");

    registry.register(mesh, { label: "Cube Mesh" });

    expect(
      serializeSourceAssetRegistry(registry, { state }).entries.map(
        (entry) => entry.label,
      ),
    ).toEqual(["Cube Mesh"]);
    expect(serializeSourceAssetRegistry(registry, { state }).entries).toEqual(
      [],
    );

    registry.markLoading(mesh);

    const loading = serializeSourceAssetRegistry(registry, { state }).entries;
    expect(loading).toHaveLength(1);
    expect(loading[0]?.status).toBe("loading");
    expect(serializeSourceAssetRegistry(registry, { state }).entries).toEqual(
      [],
    );

    registry.markReady(mesh, { vertexCount: 36 });

    const ready = serializeSourceAssetRegistry(registry, { state }).entries;
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({
      label: "Cube Mesh",
      status: "ready",
      version: 2,
      asset: { vertexCount: 36 },
    });
  });

  it("keeps full serialization available when no delta state is provided", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");

    registry.markReady(registry.register(mesh).handle, { vertexCount: 36 });

    expect(serializeSourceAssetRegistry(registry).entries).toHaveLength(1);
    expect(serializeSourceAssetRegistry(registry).entries).toHaveLength(1);
  });
});
