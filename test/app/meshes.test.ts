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

  it("partially updates a named stream through the update-range plan", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.cloth", {
      initial: createPlaneMeshAsset({ label: "Cloth" }),
    });
    const positions = mesh.get()?.vertexStreams[0]?.data;

    const result = mesh.update({
      streams: [
        {
          id: "primitive-interleaved",
          updateRanges: [{ byteOffset: 0, byteLength: 32 }],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.version).toBe(2);
    expect(result.bytes).toBe(32);
    expect(result.rangeCount).toBe(1);

    const updated = meshes.get(mesh.handle);
    // Only the named window is uploaded; the stream keeps its backing array.
    expect(updated?.vertexStreams[0]?.updateRanges).toEqual([
      { byteOffset: 0, byteLength: 32 },
    ]);
    expect(updated?.vertexStreams[0]?.data).toBe(positions);
    // The unchanged index buffer is republished with an EMPTY range list so the
    // renderer skips re-uploading it (partial, not a full re-realization).
    expect(updated?.indexBuffer?.updateRanges).toEqual([]);
  });

  it("re-uploads the whole named stream when no ranges are given", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.full", {
      initial: createPlaneMeshAsset({ label: "Full" }),
    });
    const byteLength = mesh.get()?.vertexStreams[0]?.data.byteLength ?? 0;
    const next = new Float32Array(byteLength / 4);

    const result = mesh.update({
      streams: [{ id: "primitive-interleaved", data: next }],
    });

    expect(result.ok).toBe(true);
    expect(result.bytes).toBe(byteLength);
    expect(meshes.get(mesh.handle)?.vertexStreams[0]?.updateRanges).toEqual([
      { byteOffset: 0, byteLength },
    ]);
    expect(meshes.get(mesh.handle)?.vertexStreams[0]?.data).toBe(next);
  });

  it("rejects an out-of-bounds range with a structured diagnostic", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.oob", {
      initial: createPlaneMeshAsset({ label: "OOB" }),
    });

    const result = mesh.update({
      streams: [
        {
          id: "primitive-interleaved",
          updateRanges: [{ byteOffset: 0, byteLength: 4096 }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.version).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.rangeOutOfBounds",
    );
    // A rejected update never publishes a new version.
    expect(registry.get<"mesh">(mesh.handle)?.version).toBe(1);
  });

  it("rejects a misaligned range with a structured diagnostic", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.misaligned", {
      initial: createPlaneMeshAsset({ label: "Misaligned" }),
    });

    const result = mesh.update({
      streams: [
        {
          id: "primitive-interleaved",
          updateRanges: [{ byteOffset: 2, byteLength: 8 }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.rangeMisaligned",
    );
    expect(registry.get<"mesh">(mesh.handle)?.version).toBe(1);
  });

  it("rejects a stream length/type mismatch", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.mismatch", {
      initial: createPlaneMeshAsset({ label: "Mismatch" }),
    });

    const result = mesh.update({
      streams: [{ id: "primitive-interleaved", data: new Float32Array(3) }],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.streamLengthMismatch",
    );
  });

  it("rejects an update to an unknown stream", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const mesh = meshes.dynamic("dynamic.unknown-stream", {
      initial: createPlaneMeshAsset({ label: "Unknown Stream" }),
    });

    const result = mesh.update({ streams: [{ id: "does-not-exist" }] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.unknownStream",
    );
  });

  it("rejects updating an index buffer that does not exist", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);
    const { indexBuffer: _omitted, ...noIndex } = createPlaneMeshAsset({
      label: "No Index",
    });
    meshes.publish("dynamic.no-index", noIndex);

    const result = meshes.update("dynamic.no-index", {
      index: { updateRanges: [{ byteOffset: 0, byteLength: 4 }] },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.missingIndexBuffer",
    );
  });

  it("rejects updating an unknown or unready handle and an empty update", () => {
    const registry = new AssetRegistry();
    const meshes = createMeshAccess(registry);

    const unknown = meshes.update("never.registered", {
      streams: [{ id: "primitive-interleaved" }],
    });
    expect(unknown.ok).toBe(false);
    expect(unknown.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.unknownHandle",
    );

    registry.register(createMeshHandle("registered.not-ready"), {});
    const notReady = meshes.update("registered.not-ready", {
      streams: [{ id: "primitive-interleaved" }],
    });
    expect(notReady.ok).toBe(false);
    expect(notReady.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.notReady",
    );

    const mesh = meshes.dynamic("dynamic.empty", {
      initial: createPlaneMeshAsset({ label: "Empty" }),
    });
    const empty = mesh.update({});
    expect(empty.ok).toBe(false);
    expect(empty.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "meshUpdate.emptyUpdate",
    );
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
