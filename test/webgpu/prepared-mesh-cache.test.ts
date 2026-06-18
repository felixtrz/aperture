import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createMeshHandle,
  createPlaneMeshAsset,
  evictPreparedMeshGpuResourceCacheEntries,
  createPreparedMeshGpuResourceCacheSummary,
  createPreparedMeshGpuResourceCache,
  prepareMeshGpuResource,
  writePreparedMeshGpuResourceCacheSummary,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";
import type { MeshAsset } from "@aperture-engine/render";

describe("prepared mesh GPU resource cache", () => {
  it("creates, reuses, and updates same-layout mesh GPU resources by source version", () => {
    const gpu = createGpuBufferLog();
    const cache = createPreparedMeshGpuResourceCache();
    const handle = createMeshHandle("cube");
    const mesh = createBoxMeshAsset({ label: "Cube" });
    const device = deviceWithBufferLog(gpu);

    const first = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 1,
    });
    const writesAfterFirst = gpu.writes.length;
    const buffersAfterFirst = gpu.buffers.length;
    const second = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 1,
    });
    const writesAfterSecond = gpu.writes.length;
    const buffersAfterSecond = gpu.buffers.length;
    const third = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 2,
    });

    expect(first.status).toBe("created");
    expect(first.resource).toMatchObject({
      sourceMeshKey: "mesh:cube",
      sourceVersion: 1,
      lastUsedFrame: 0,
    });
    expect(first.resource?.layoutKey).toContain("mesh-upload-layout");
    expect(first.resource?.mesh.vertexBuffers.length).toBeGreaterThan(0);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(writesAfterSecond).toBe(writesAfterFirst);
    expect(buffersAfterSecond).toBe(buffersAfterFirst);
    expect(third.status).toBe("reused");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(2);
    expect(third.resource?.mesh.resourceKey).toBe("mesh-buffer:mesh:cube@v2");
    expect(third.resource?.mesh.vertexBuffers[0]?.buffer).toBe(
      first.resource?.mesh.vertexBuffers[0]?.buffer,
    );
    expect(third.resource?.mesh.indexBuffer?.buffer).toBe(
      first.resource?.mesh.indexBuffer?.buffer,
    );
    expect(gpu.buffers.length).toBe(buffersAfterFirst);
    expect(gpu.writes.length).toBeGreaterThan(writesAfterFirst);
  });

  it("creates a new mesh GPU resource when a version bump changes layout", () => {
    const gpu = createGpuBufferLog();
    const cache = createPreparedMeshGpuResourceCache();
    const handle = createMeshHandle("dynamic");
    const device = deviceWithBufferLog(gpu);

    const first = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh: createPlaneMeshAsset({ label: "Dynamic" }),
      sourceVersion: 1,
    });
    const buffersAfterFirst = gpu.buffers.length;
    const second = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh: createBoxMeshAsset({ label: "Dynamic" }),
      sourceVersion: 2,
    });

    expect(first.status).toBe("created");
    expect(second.status).toBe("created");
    expect(second.resource?.mesh.vertexBuffers[0]?.buffer).not.toBe(
      first.resource?.mesh.vertexBuffers[0]?.buffer,
    );
    expect(gpu.buffers.length).toBeGreaterThan(buffersAfterFirst);
  });

  it("writes only declared update ranges when reusing same-layout mesh GPU resources", () => {
    const gpu = createGpuBufferLog();
    const cache = createPreparedMeshGpuResourceCache();
    const handle = createMeshHandle("dynamic.range");
    const device = deviceWithBufferLog(gpu);
    const first = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh: rangeMesh(new Float32Array(8)),
      sourceVersion: 1,
    });
    const writesAfterFirst = gpu.writes.length;
    const buffersAfterFirst = gpu.buffers.length;
    const changed = new Float32Array(8);
    changed[4] = 10;
    const second = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh: rangeMesh(changed, [{ byteOffset: 16, byteLength: 16 }]),
      sourceVersion: 2,
    });

    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(gpu.buffers.length).toBe(buffersAfterFirst);
    expect(gpu.writes.slice(writesAfterFirst)).toEqual([
      {
        buffer: first.resource?.mesh.vertexBuffers[0]?.buffer,
        bufferOffset: 16,
        data: changed.buffer,
        dataOffset: changed.byteOffset + 16,
        size: 16,
      },
    ]);
  });

  it("tracks last-used frames for prepared mesh backend cache entries", () => {
    const cache = createPreparedMeshGpuResourceCache();
    const handle = createMeshHandle("cube");
    const mesh = createBoxMeshAsset({ label: "Cube" });
    const device = deviceWithBuffers([]);

    const first = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 1,
      frame: 10,
    });
    const second = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 1,
      frame: 12,
    });
    const third = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 2,
      frame: 14,
    });

    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(first.resource?.lastUsedFrame).toBe(12);
    expect(third.status).toBe("reused");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.lastUsedFrame).toBe(14);
    expect(
      [...cache.resources.values()].map((entry) => entry.lastUsedFrame),
    ).toEqual([12, 14]);
  });

  it("keeps prepared mesh resources scoped to mesh buffers only", () => {
    const result = prepareMeshGpuResource({
      device: deviceWithBuffers([]),
      cache: createPreparedMeshGpuResourceCache(),
      handle: createMeshHandle("cube"),
      mesh: createBoxMeshAsset({ label: "Cube" }),
      sourceVersion: 1,
    });

    expect(result.valid).toBe(true);
    expect(result.resource).not.toHaveProperty("material");
    expect(result.resource).not.toHaveProperty("bindGroup");
    expect(result.resource).not.toHaveProperty("worldTransforms");
    expect(result.resource).not.toHaveProperty("viewUniforms");
  });

  it("keeps same-label prepared mesh GPU resource keys distinct by source mesh", () => {
    const cache = createPreparedMeshGpuResourceCache();
    const device = deviceWithBuffers([]);
    const first = prepareMeshGpuResource({
      device,
      cache,
      handle: createMeshHandle("tree.cone0"),
      mesh: createBoxMeshAsset({ label: "Cone" }),
      sourceVersion: 1,
    });
    const second = prepareMeshGpuResource({
      device,
      cache,
      handle: createMeshHandle("tree.cone1"),
      mesh: createBoxMeshAsset({ label: "Cone" }),
      sourceVersion: 1,
    });

    expect(first.status).toBe("created");
    expect(second.status).toBe("created");
    expect(first.resource?.layoutKey).toBe(second.resource?.layoutKey);
    expect(first.resource?.mesh.resourceKey).toBe(
      "mesh-buffer:mesh:tree.cone0@v1",
    );
    expect(second.resource?.mesh.resourceKey).toBe(
      "mesh-buffer:mesh:tree.cone1@v1",
    );
    expect(first.resource?.mesh.resourceKey).not.toBe(
      second.resource?.mesh.resourceKey,
    );
  });

  it("summarizes an empty prepared mesh backend cache", () => {
    const cache = createPreparedMeshGpuResourceCache();
    const summary = createPreparedMeshGpuResourceCacheSummary();
    const result = writePreparedMeshGpuResourceCacheSummary(summary, cache);

    expect(result).toBe(summary);
    expect(summary).toEqual({ totalEntries: 0, layouts: [] });
  });

  it("summarizes prepared mesh backend cache entries by layout", () => {
    const cache = createPreparedMeshGpuResourceCache();
    const device = deviceWithBuffers([]);
    const cube = createMeshHandle("cube");
    const plane = createMeshHandle("plane");

    prepareMeshGpuResource({
      device,
      cache,
      handle: cube,
      mesh: createBoxMeshAsset({ label: "Cube" }),
      sourceVersion: 1,
    });
    prepareMeshGpuResource({
      device,
      cache,
      handle: cube,
      mesh: createBoxMeshAsset({ label: "Cube Updated" }),
      sourceVersion: 2,
    });
    prepareMeshGpuResource({
      device,
      cache,
      handle: plane,
      mesh: createPlaneMeshAsset({ label: "Plane" }),
      sourceVersion: 1,
    });

    const summary = writePreparedMeshGpuResourceCacheSummary(
      createPreparedMeshGpuResourceCacheSummary(),
      cache,
    );

    expect(summary.totalEntries).toBe(3);
    expect(summary.layouts).toHaveLength(2);
    expect(summary.layouts.map((layout) => layout.entries).sort()).toEqual([
      1, 2,
    ]);
    expect(summary.layouts.map((layout) => layout.layoutKey)).toEqual(
      [...summary.layouts.map((layout) => layout.layoutKey)].sort(),
    );

    const json = JSON.stringify(summary);

    expect(json).toContain("mesh-upload-layout");
    expect(json).not.toContain("GPU");
    expect(json).not.toContain("ArrayBuffer");
    expect(json).not.toContain("data");
    expect(json).not.toContain("lastUsedFrame");
  });

  it("clears stale layout summary rows when the backend cache is cleared", () => {
    const cache = createPreparedMeshGpuResourceCache();
    const summary = createPreparedMeshGpuResourceCacheSummary();

    prepareMeshGpuResource({
      device: deviceWithBuffers([]),
      cache,
      handle: createMeshHandle("cube"),
      mesh: createBoxMeshAsset({ label: "Cube" }),
      sourceVersion: 1,
    });

    writePreparedMeshGpuResourceCacheSummary(summary, cache);
    expect(summary.totalEntries).toBe(1);
    expect(summary.layouts).toHaveLength(1);

    cache.resources.clear();

    const result = writePreparedMeshGpuResourceCacheSummary(summary, cache);

    expect(result).toBe(summary);
    expect(summary).toEqual({ totalEntries: 0, layouts: [] });
  });

  it("evicts prepared mesh backend cache entries by last-used frame", () => {
    const cache = createPreparedMeshGpuResourceCache();
    const device = deviceWithBuffers([]);

    prepareMeshGpuResource({
      device,
      cache,
      handle: createMeshHandle("in-use"),
      mesh: createBoxMeshAsset({ label: "In Use" }),
      sourceVersion: 1,
      frame: 20,
    });
    prepareMeshGpuResource({
      device,
      cache,
      handle: createMeshHandle("retained"),
      mesh: createBoxMeshAsset({ label: "Retained" }),
      sourceVersion: 1,
      frame: 17,
    });
    prepareMeshGpuResource({
      device,
      cache,
      handle: createMeshHandle("evicted"),
      mesh: createBoxMeshAsset({ label: "Evicted" }),
      sourceVersion: 1,
      frame: 16,
    });

    const report = evictPreparedMeshGpuResourceCacheEntries(cache, {
      currentFrame: 20,
      maxUnusedFrames: 3,
    });

    expect(report).toEqual({
      checked: 3,
      retained: 1,
      evicted: 1,
      skippedInUse: 1,
    });
    expect(cache.resources.size).toBe(2);
    expect(
      [...cache.resources.values()].map((entry) => entry.sourceMeshKey).sort(),
    ).toEqual(["mesh:in-use", "mesh:retained"]);
    expect(JSON.stringify(report)).not.toContain("GPU");
    expect(JSON.stringify(report)).not.toContain("Float32Array");
  });

  it("reports zero counts when evicting an empty prepared mesh backend cache", () => {
    const report = evictPreparedMeshGpuResourceCacheEntries(
      createPreparedMeshGpuResourceCache(),
      {
        currentFrame: 1,
        maxUnusedFrames: 0,
      },
    );

    expect(report).toEqual({
      checked: 0,
      retained: 0,
      evicted: 0,
      skippedInUse: 0,
    });
  });
});

function deviceWithBuffers(created: unknown[]): WebGpuBufferDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        created.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
  };
}

function rangeMesh(
  data: Float32Array,
  updateRanges?: readonly { readonly byteOffset: number; readonly byteLength: number }[],
): MeshAsset {
  return {
    kind: "mesh",
    label: "Range mesh",
    vertexStreams: [
      {
        id: "positions",
        arrayStride: 16,
        vertexCount: 2,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
        data,
        ...(updateRanges === undefined ? {} : { updateRanges }),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1]),
      updateRanges: [],
    },
    submeshes: [
      {
        label: "default",
        topology: "line-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 2,
        indexStart: 0,
        indexCount: 2,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
  };
}

interface GpuBufferLog {
  readonly buffers: unknown[];
  readonly writes: unknown[];
}

function createGpuBufferLog(): GpuBufferLog {
  return { buffers: [], writes: [] };
}

function deviceWithBufferLog(log: GpuBufferLog): WebGpuBufferDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        log.writes.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => {
      const buffer = { descriptor };
      log.buffers.push(buffer);
      return buffer;
    },
  };
}
