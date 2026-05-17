import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createMeshHandle,
  createPreparedMeshGpuResourceCache,
  prepareMeshGpuResource,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("prepared mesh GPU resource cache", () => {
  it("creates, reuses, and invalidates mesh GPU resources by source version", () => {
    const createdBuffers: unknown[] = [];
    const cache = createPreparedMeshGpuResourceCache();
    const handle = createMeshHandle("cube");
    const mesh = createBoxMeshAsset({ label: "Cube" });
    const device = deviceWithBuffers(createdBuffers);

    const first = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 1,
    });
    const buffersAfterFirst = createdBuffers.length;
    const second = prepareMeshGpuResource({
      device,
      cache,
      handle,
      mesh,
      sourceVersion: 1,
    });
    const buffersAfterSecond = createdBuffers.length;
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
    });
    expect(first.resource?.layoutKey).toContain("mesh-upload-layout");
    expect(first.resource?.mesh.vertexBuffers.length).toBeGreaterThan(0);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(buffersAfterSecond).toBe(buffersAfterFirst);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(2);
    expect(createdBuffers.length).toBeGreaterThan(buffersAfterFirst);
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
