import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMeshHandle,
  createShaderHandle,
} from "@aperture-engine/simulation";
import { createWgslShaderAsset, type MeshAsset } from "@aperture-engine/render";
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

  it("serializes and mirrors source asset provenance", () => {
    const workerRegistry = new AssetRegistry();
    const mainRegistry = new AssetRegistry();
    const shader = createShaderHandle("placeholder-shader");

    workerRegistry.register(shader, { label: "Placeholder WGSL" });
    workerRegistry.markReady(
      shader,
      createWgslShaderAsset({
        label: "Placeholder WGSL",
        source: "fn fs_main() -> vec4f { return vec4f(1.0); }",
      }),
      [],
      "placeholder",
    );

    const serialized = serializeSourceAssetRegistry(workerRegistry);
    expect(serialized.entries[0]).toMatchObject({
      provenance: "placeholder",
    });

    const report = mirrorSourceAssetRegistryFromMessage(mainRegistry, {
      sourceAssets: serialized,
    });

    expect(report).toEqual({ mirrored: 1, skipped: 0 });
    expect(mainRegistry.get(shader)?.provenance).toBe("placeholder");
    expect(mainRegistry.createManifestReport().placeholders).toEqual({
      count: 1,
      ids: ["placeholder-shader"],
    });
  });

  it("serializes same-layout mesh revisions as byte-range patches", () => {
    const workerRegistry = new AssetRegistry();
    const mainRegistry = new AssetRegistry();
    const state = createSourceAssetSerializationState();
    const mesh = createMeshHandle("trail");
    const firstMesh = createTestMeshAsset(new Float32Array([0, 1, 2, 3]));

    workerRegistry.register(mesh, { label: "Trail" });
    workerRegistry.markReady(mesh, firstMesh);

    const firstSerialized = serializeSourceAssetRegistry(workerRegistry, {
      state,
    });
    expect(firstSerialized.entries[0]?.asset).toMatchObject({
      kind: "mesh",
      label: "Trail",
    });
    commitSerializedSourceAssets(state, firstSerialized);
    expect(
      mirrorSourceAssetRegistryFromMessage(mainRegistry, {
        sourceAssets: firstSerialized,
      }),
    ).toEqual({ mirrored: 1, skipped: 0 });
    const firstMirroredData = mainRegistry.get<"mesh", MeshAsset>(mesh)?.asset
      ?.vertexStreams[0]?.data;

    workerRegistry.markReady(
      mesh,
      createTestMeshAsset(new Float32Array([0, 1, 20, 30]), {
        updateRanges: [{ byteOffset: 8, byteLength: 8 }],
        vertexCount: 4,
      }),
    );

    const secondSerialized = serializeSourceAssetRegistry(workerRegistry, {
      state,
    });
    const patch = secondSerialized.entries[0]?.asset as
      | {
          readonly kind?: string;
          readonly vertexStreams?: readonly {
            readonly updates?: readonly {
              readonly byteOffset: number;
              readonly byteLength: number;
              readonly data: Uint8Array;
            }[];
          }[];
        }
      | undefined;

    expect(patch).toMatchObject({
      kind: "aperture.meshAssetPatch.v1",
    });
    expect(patch?.vertexStreams?.[0]?.updates).toHaveLength(1);
    expect(patch?.vertexStreams?.[0]?.updates?.[0]).toMatchObject({
      byteOffset: 8,
      byteLength: 8,
    });
    expect(patch?.vertexStreams?.[0]?.updates?.[0]?.data.byteLength).toBe(8);

    commitSerializedSourceAssets(state, secondSerialized);
    expect(
      mirrorSourceAssetRegistryFromMessage(mainRegistry, {
        sourceAssets: secondSerialized,
      }),
    ).toEqual({ mirrored: 1, skipped: 0 });

    const mirrored = mainRegistry.get<"mesh", MeshAsset>(mesh);
    const stream = mirrored?.asset?.vertexStreams[0];

    expect(mirrored?.version).toBe(2);
    expect(stream?.data).toBe(firstMirroredData);
    expect(stream?.updateRanges).toEqual([{ byteOffset: 8, byteLength: 8 }]);
    expect(Array.from((stream?.data as Float32Array) ?? [])).toEqual([
      0, 1, 20, 30,
    ]);
    expect(mirrored?.asset?.submeshes[0]?.vertexCount).toBe(4);

    workerRegistry.markReady(
      mesh,
      createTestMeshAsset(new Float32Array([0, 1, 20, 30, 40]), {
        updateRanges: [{ byteOffset: 16, byteLength: 4 }],
        vertexCount: 5,
      }),
    );

    const layoutChange = serializeSourceAssetRegistry(workerRegistry, {
      state,
    });

    expect(layoutChange.entries[0]?.asset).toMatchObject({
      kind: "mesh",
      label: "Trail",
    });
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

function createTestMeshAsset(
  data: Float32Array,
  options: {
    readonly updateRanges?: readonly {
      readonly byteOffset: number;
      readonly byteLength: number;
    }[];
    readonly vertexCount?: number;
  } = {},
): MeshAsset {
  const vertexCount = options.vertexCount ?? data.length;

  return {
    kind: "mesh",
    label: "Trail",
    vertexStreams: [
      {
        id: "positions",
        arrayStride: 4,
        vertexCount: data.length,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
        data,
        ...(options.updateRanges === undefined
          ? {}
          : { updateRanges: options.updateRanges }),
      },
    ],
    submeshes: [
      {
        label: "default",
        topology: "point-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount,
        indexStart: 0,
        indexCount: vertexCount,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [0, 0, 0], max: [1, 1, 1] },
    localSphere: { center: [0, 0, 0], radius: 1 },
  };
}
