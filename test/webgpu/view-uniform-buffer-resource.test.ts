import { describe, expect, it } from "vitest";

import {
  createViewUniformBufferDescriptor,
  createViewUniformGpuBuffer,
  type PackedSnapshotViewUniforms,
  type ViewUniformBufferDescriptorPlan,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("view uniform GPU buffer resource creation", () => {
  it("creates view uniform buffer resources", () => {
    const created: unknown[] = [];
    const plan = descriptorPlan(packedViews(2));
    const result = createViewUniformGpuBuffer({
      device: deviceWithBuffers(created),
      plan,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "view-uniform-buffer:ViewUniforms/uniform",
      views: [
        { viewId: 0, sourceOffset: 0, packedOffset: 0 },
        { viewId: 1, sourceOffset: 16, packedOffset: 16 },
      ],
    });
    expect(created).toHaveLength(1);
  });

  it("reports null descriptor plans and buffer creation failures", () => {
    const plan = descriptorPlan(packedViews(1));
    const invalidPlan: ViewUniformBufferDescriptorPlan = {
      ...plan,
      descriptor: { ...plan.descriptor, size: 0 },
    };

    expect(
      createViewUniformGpuBuffer({
        device: deviceWithBuffers([]),
        plan: null,
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "viewUniformGpuBuffer.nullDescriptorPlan" }],
    });
    expect(
      createViewUniformGpuBuffer({
        device: deviceWithBuffers([]),
        plan: invalidPlan,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["viewUniformGpuBuffer.creationFailed"]);
  });
});

function descriptorPlan(
  packed: PackedSnapshotViewUniforms,
): ViewUniformBufferDescriptorPlan {
  return required(createViewUniformBufferDescriptor(packed).plan);
}

function packedViews(count: number): PackedSnapshotViewUniforms {
  return {
    data: new Float32Array(count * 16),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index,
      sourceOffset: index * 16,
      packedOffset: index * 16,
    })),
    diagnostics: [],
  };
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
