import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMeshHandle,
  createShaderHandle,
} from "@aperture-engine/simulation";
import { createWgslShaderAsset } from "@aperture-engine/render";
import {
  commitSerializedSourceAssets,
  mirrorSourceAssetRegistryFromMessage,
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "../../packages/app/src/asset-mirror.js";

describe("generated app source asset mirroring", () => {
  it("serializes only asset entries that changed since the last committed snapshot", () => {
    const registry = new AssetRegistry();
    const state = createSourceAssetSerializationState();
    const mesh = createMeshHandle("cube");

    registry.register(mesh, { label: "Cube Mesh" });

    const registered = serializeSourceAssetRegistry(registry, { state });
    expect(registered.entries.map((entry) => entry.label)).toEqual([
      "Cube Mesh",
    ]);
    commitSerializedSourceAssets(state, registered);
    expect(serializeSourceAssetRegistry(registry, { state }).entries).toEqual(
      [],
    );

    registry.markLoading(mesh);

    const loading = serializeSourceAssetRegistry(registry, { state });
    expect(loading.entries).toHaveLength(1);
    expect(loading.entries[0]?.status).toBe("loading");
    commitSerializedSourceAssets(state, loading);
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

  it("re-serializes entries when the previous snapshot was never committed (failed postMessage)", () => {
    const registry = new AssetRegistry();
    const state = createSourceAssetSerializationState();
    const mesh = createMeshHandle("cube");

    registry.register(mesh, { label: "Cube Mesh" });

    // Simulates a postMessage that threw after serialization: without a
    // commit, the same entries must remain eligible for the next frame.
    const attempt = serializeSourceAssetRegistry(registry, { state });
    expect(attempt.entries).toHaveLength(1);

    const retry = serializeSourceAssetRegistry(registry, { state });
    expect(retry.entries).toHaveLength(1);

    commitSerializedSourceAssets(state, retry);
    expect(serializeSourceAssetRegistry(registry, { state }).entries).toEqual(
      [],
    );

    // A stale commit (from an out-of-order older snapshot) must not regress
    // the recorded version.
    registry.markLoading(mesh);
    const newer = serializeSourceAssetRegistry(registry, { state });
    expect(newer.entries).toHaveLength(1);
    commitSerializedSourceAssets(state, newer);
    commitSerializedSourceAssets(state, attempt);
    expect(serializeSourceAssetRegistry(registry, { state }).entries).toEqual(
      [],
    );
  });

  it("keeps full serialization available when no delta state is provided", () => {
    const registry = new AssetRegistry();
    const mesh = createMeshHandle("cube");

    registry.markReady(registry.register(mesh).handle, { vertexCount: 36 });

    expect(serializeSourceAssetRegistry(registry).entries).toHaveLength(1);
    expect(serializeSourceAssetRegistry(registry).entries).toHaveLength(1);
  });

  it("mirrors shader source assets by handle version", () => {
    const workerRegistry = new AssetRegistry();
    const mainRegistry = new AssetRegistry();
    const state = createSourceAssetSerializationState();
    const shader = createShaderHandle("water");

    workerRegistry.register(shader, { label: "Water WGSL" });
    workerRegistry.markReady(
      shader,
      createWgslShaderAsset({
        label: "Water WGSL",
        source: "fn fs_main() -> vec4f { return vec4f(1.0); }",
        url: "/shaders/water.wgsl",
      }),
    );

    const firstSerialized = serializeSourceAssetRegistry(workerRegistry, {
      state,
    });
    commitSerializedSourceAssets(state, firstSerialized);
    const firstMessage = { sourceAssets: firstSerialized };
    const firstMirror = mirrorSourceAssetRegistryFromMessage(
      mainRegistry,
      firstMessage,
    );
    const mirrored = mainRegistry.get(shader);

    expect(firstMirror).toEqual({ mirrored: 1, skipped: 0 });
    expect(mirrored).toMatchObject({
      kind: "shader",
      label: "Water WGSL",
      status: "ready",
      version: 1,
      asset: {
        kind: "shader",
        language: "wgsl",
        url: "/shaders/water.wgsl",
      },
    });
    expect(
      serializeSourceAssetRegistry(workerRegistry, { state }).entries,
    ).toEqual([]);
  });

  it("treats an absent or empty sourceAssets field as a no-op (AI-70 send-on-change contract)", () => {
    const registry = new AssetRegistry();

    // The worker omits the sourceAssets field entirely on steady-state frames;
    // the receiver must no-op rather than throw or clear existing state.
    expect(
      mirrorSourceAssetRegistryFromMessage(registry, {
        type: "snapshot",
        frame: 7,
      }),
    ).toEqual({ mirrored: 0, skipped: 0 });

    expect(
      mirrorSourceAssetRegistryFromMessage(registry, {
        type: "snapshot",
        frame: 7,
        sourceAssets: { entries: [] },
      }),
    ).toEqual({ mirrored: 0, skipped: 0 });
  });
});
