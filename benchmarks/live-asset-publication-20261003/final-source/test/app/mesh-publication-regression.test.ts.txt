import { describe, expect, it } from "vitest";
import { AssetRegistry } from "@aperture-engine/simulation";
import { createMeshAccess } from "@aperture-engine/app/systems";
import {
  createPreparedMeshStore,
  createTriangleListMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  createPreparedMeshGpuResourceCache,
  prepareMeshGpuResource,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";
import {
  commitSerializedSourceAssets,
  createSourceAssetSerializationState,
  mirrorSourceAssetRegistryFromMessage,
  serializeSourceAssetRegistry,
} from "../../packages/app/src/asset-mirror.js";

describe("live mesh publication through the source-asset mirror", () => {
  it.each([false, true])(
    "delivers replacement bytes with indexed=%s when update ranges are absent",
    (indexed) => {
      const workerRegistry = new AssetRegistry();
      const mainRegistry = new AssetRegistry();
      const meshes = createMeshAccess(workerRegistry);
      const state = createSourceAssetSerializationState();
      const prepared = createPreparedMeshStore();
      const gpuCache = createPreparedMeshGpuResourceCache();
      const uploads = new Map<unknown, Uint8Array>();
      let writes = 0;
      const device: WebGpuBufferDeviceLike = {
        createBuffer(descriptor) {
          const buffer = { descriptor };
          uploads.set(buffer, new Uint8Array(descriptor.size));
          return buffer;
        },
        queue: {
          writeBuffer(buffer, offset, data, dataOffset = 0, size) {
            const source = ArrayBuffer.isView(data) ? data.buffer : data;
            const bytes = new Uint8Array(source, dataOffset, size);
            uploads.get(buffer)!.set(bytes, offset);
            writes += 1;
          },
        },
      };
      const createMesh = (x: number) =>
        createTriangleListMeshAsset({
          label: "Published triangle",
          positions: [
            [x, 0, 0],
            [x + 1, 0, 0],
            [x, 1, 0],
          ],
          ...(indexed
            ? {
                indices: x === 0 ? [0, 1, 2] : [2, 1, 0],
                normals: [
                  [0, 0, 1],
                  [0, 0, 1],
                  [0, 0, 1],
                ],
              }
            : {}),
        });
      const original = createMesh(0);
      expect(original.indexBuffer !== undefined).toBe(indexed);
      const publication = meshes.publish("published.triangle", original);
      const handle = publication.handle;
      const deliver = () => {
        const serialized = serializeSourceAssetRegistry(workerRegistry, {
          state,
        });
        // Worker messages clone payloads: the mirror must never share author arrays.
        const message = structuredClone({ sourceAssets: serialized });
        commitSerializedSourceAssets(state, serialized);
        return mirrorSourceAssetRegistryFromMessage(mainRegistry, message);
      };
      expect(deliver()).toEqual({ mirrored: 1, skipped: 0 });
      const firstEntry = mainRegistry.get<"mesh", MeshAsset>(handle)!;
      expect(firstEntry.asset!.vertexStreams[0]!.data).not.toBe(
        original.vertexStreams[0]!.data,
      );
      prepared.prepare({ registry: mainRegistry, handle });
      const initialGpu = prepareMeshGpuResource({
        device,
        cache: gpuCache,
        handle,
        mesh: firstEntry.asset!,
        sourceVersion: firstEntry.version,
      });
      expect(initialGpu.valid).toBe(true);
      const writesBefore = writes;
      const replacement = createMesh(2);
      expect(meshes.publish(handle, replacement).version).toBe(2);
      expect(deliver()).toEqual({ mirrored: 1, skipped: 0 });
      const mirrored = mainRegistry.get<"mesh", MeshAsset>(handle)!;
      const facade = prepared.prepare({ registry: mainRegistry, handle });
      const updatedGpu = prepareMeshGpuResource({
        device,
        cache: gpuCache,
        handle,
        mesh: mirrored.asset!,
        sourceVersion: mirrored.version,
      });
      expect(mirrored.version).toBe(2);
      expect(facade.entry?.sourceVersion).toBe(2);
      expect(updatedGpu.resource?.sourceVersion).toBe(2);
      expect(updatedGpu.resource?.mesh.vertexBuffers[0]?.buffer).toBe(
        initialGpu.resource?.mesh.vertexBuffers[0]?.buffer,
      );
      expect(writes).toBeGreaterThan(writesBefore);
      const expected = replacement.vertexStreams[0]!.data;
      expect(bytes(mirrored.asset!.vertexStreams[0]!.data)).toEqual(
        bytes(expected),
      );
      expect(
        uploads
          .get(updatedGpu.resource!.mesh.vertexBuffers[0]!.buffer)!
          .subarray(0, expected.byteLength),
      ).toEqual(bytes(expected));
      if (indexed) {
        const expectedIndices = replacement.indexBuffer!.data;
        expect(bytes(mirrored.asset!.indexBuffer!.data)).toEqual(
          bytes(expectedIndices),
        );
        expect(
          uploads
            .get(updatedGpu.resource!.mesh.indexBuffer!.buffer)!
            .subarray(0, expectedIndices.byteLength),
        ).toEqual(bytes(expectedIndices));
      }
      expect(
        serializeSourceAssetRegistry(workerRegistry, { state }).entries,
      ).toEqual([]);
    },
  );
  it("keeps explicit range patches and empty index updates selective", () => {
    const worker = new AssetRegistry();
    const main = new AssetRegistry();
    const state = createSourceAssetSerializationState();
    const meshes = createMeshAccess(worker);
    const baseline = createTriangleListMeshAsset({
      positions: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
      normals: [
        [0, 0, 1],
        [0, 0, 1],
        [0, 0, 1],
      ],
      indices: [0, 1, 2],
    });
    const { handle } = meshes.publish("range.triangle", baseline);
    const deliver = () => {
      const serialized = serializeSourceAssetRegistry(worker, { state });
      const received = structuredClone({ sourceAssets: serialized });
      commitSerializedSourceAssets(state, serialized);
      mirrorSourceAssetRegistryFromMessage(main, received);
      return serialized;
    };
    deliver();
    const before = main.get<"mesh", MeshAsset>(handle)!.asset!;
    const replacement: MeshAsset = {
      ...baseline,
      vertexStreams: baseline.vertexStreams.map((stream) => {
        const data = new Float32Array(stream.data);
        data[0] = 0.5;
        return {
          ...stream,
          data,
          updateRanges: [{ byteOffset: 0, byteLength: 4 }],
        };
      }),
      indexBuffer: { ...baseline.indexBuffer!, updateRanges: [] },
    };
    meshes.publish(handle, replacement);
    const sent = deliver();
    expect(sent.entries[0]?.asset).toMatchObject({
      kind: "aperture.meshAssetPatch.v1",
      vertexStreams: [{ updates: [{ byteOffset: 0, byteLength: 4 }] }],
      indexBuffer: { updates: [] },
    });
    const after = main.get<"mesh", MeshAsset>(handle)!.asset!;
    expect(after.vertexStreams[0]!.data).toBe(before.vertexStreams[0]!.data);
    expect(bytes(after.vertexStreams[0]!.data)).toEqual(
      bytes(replacement.vertexStreams[0]!.data),
    );
    expect(after.vertexStreams[0]!.updateRanges).toEqual([
      { byteOffset: 0, byteLength: 4 },
    ]);
    expect(after.indexBuffer!.data).toBe(before.indexBuffer!.data);
    expect(after.indexBuffer!.updateRanges).toEqual([]);
    const writes: { offset: number; size: number | undefined }[] = [];
    const device: WebGpuBufferDeviceLike = {
      createBuffer: () => ({}),
      queue: {
        writeBuffer: (_buffer, offset, _data, _dataOffset, size) => {
          writes.push({ offset, size });
        },
      },
    };
    const cache = createPreparedMeshGpuResourceCache();
    prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh: baseline,
      sourceVersion: 1,
    });
    writes.length = 0;
    const updated = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh: after,
      sourceVersion: 2,
    });
    expect(updated.valid).toBe(true);
    expect(writes).toEqual([{ offset: 0, size: 4 }]);
  });
});

function bytes(data: ArrayBufferView): Uint8Array {
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
