import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createMeshGpuBuffers,
  createMeshGpuUploadPlan,
  createMeshUploadBufferDescriptors,
  createPlaneMeshAsset,
  type MeshUploadBufferDescriptorPlan,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("mesh GPU buffer resource creation", () => {
  it("creates vertex and index resources for indexed meshes", () => {
    const created: unknown[] = [];
    const device = deviceWithBuffers(created);
    const plan = descriptorPlan(createBoxMeshAsset({ label: "Cube" }));
    const result = createMeshGpuBuffers({ device, plan });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "mesh-buffer:Cube",
      vertexCount: 24,
      vertexBuffers: [
        {
          streamId: "primitive-interleaved",
          resourceKey: "mesh-vertex-buffer:Cube/vertex:primitive-interleaved",
          vertexCount: 24,
        },
      ],
      indexBuffer: {
        resourceKey: "mesh-index-buffer:Cube/index",
        format: "uint16",
        indexCount: 36,
      },
    });
    expect(created).toHaveLength(2);
  });

  it("creates vertex-only resources for non-indexed meshes", () => {
    const plane = createPlaneMeshAsset({ label: "Ground" });
    const { indexBuffer: _indexBuffer, ...nonIndexed } = plane;
    const result = createMeshGpuBuffers({
      device: deviceWithBuffers([]),
      plan: descriptorPlan(nonIndexed),
    });

    expect(result.valid).toBe(true);
    expect(result.resource?.vertexCount).toBe(4);
    expect(result.resource?.vertexBuffers).toHaveLength(1);
    expect(result.resource?.indexBuffer).toBeUndefined();
  });

  it("reports null plans and vertex creation failures", () => {
    const plan = descriptorPlan(createPlaneMeshAsset({ label: "Broken" }));
    const invalidVertexPlan: MeshUploadBufferDescriptorPlan = {
      ...plan,
      vertexBuffers: [
        {
          ...required(plan.vertexBuffers[0]),
          descriptor: {
            ...required(plan.vertexBuffers[0]).descriptor,
            size: 0,
          },
        },
      ],
    };

    expect(
      createMeshGpuBuffers({ device: deviceWithBuffers([]), plan: null }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "meshGpuBuffer.nullDescriptorPlan" }],
    });
    expect(
      createMeshGpuBuffers({
        device: deviceWithBuffers([]),
        plan: invalidVertexPlan,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["meshGpuBuffer.vertexCreationFailed"]);
  });

  it("reports index creation failures while preserving created vertex buffers", () => {
    const plan = descriptorPlan(createBoxMeshAsset({ label: "Partial" }));
    const indexBuffer = required(plan.indexBuffer);
    const invalidIndexPlan: MeshUploadBufferDescriptorPlan = {
      ...plan,
      indexBuffer: {
        ...indexBuffer,
        descriptor: { ...indexBuffer.descriptor, size: 0 },
      },
    };
    const result = createMeshGpuBuffers({
      device: deviceWithBuffers([]),
      plan: invalidIndexPlan,
    });

    expect(result.valid).toBe(false);
    expect(result.resource?.vertexCount).toBe(24);
    expect(result.resource?.vertexBuffers).toHaveLength(1);
    expect(result.resource?.indexBuffer).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "meshGpuBuffer.indexCreationFailed",
    ]);
  });
});

function descriptorPlan(mesh: ReturnType<typeof createBoxMeshAsset>) {
  return required(
    createMeshUploadBufferDescriptors(
      required(createMeshGpuUploadPlan(mesh).plan),
    ).plan,
  );
}

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

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
