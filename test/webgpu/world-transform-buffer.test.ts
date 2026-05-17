import { describe, expect, it } from "vitest";

import {
  createWorldTransformBufferDescriptorScratch,
  createWorldTransformBufferDescriptor,
  createWorldTransformGpuBuffer,
  DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE,
  writeWorldTransformBufferDescriptor,
  type PackedSnapshotTransforms,
  type WebGpuBufferDeviceLike,
  type WorldTransformBufferDescriptorPlan,
} from "@aperture-engine/webgpu";

describe("world transform GPU buffer resources", () => {
  it("creates storage buffer descriptors and resources for packed transforms", () => {
    const created: unknown[] = [];
    const packed = packedTransforms(2);
    const descriptor = createWorldTransformBufferDescriptor(packed);
    const result = createWorldTransformGpuBuffer({
      device: deviceWithBuffers(created),
      plan: required(descriptor.plan),
    });

    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan).toMatchObject({
      source: packed.data,
      offsets: packed.offsets,
      descriptor: {
        label: "WorldTransforms/storage",
        size: 2 * 16 * 4,
        usage: DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE,
      },
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "world-transform-buffer:WorldTransforms/storage",
      offsets: packed.offsets,
    });
    expect(created).toHaveLength(1);
  });

  it("uses logical float count and reuses caller-owned descriptor scratch", () => {
    const scratch = createWorldTransformBufferDescriptorScratch();
    const packed = {
      ...packedTransforms(2),
      data: new Float32Array(64),
      floatCount: 32,
    };
    const first = writeWorldTransformBufferDescriptor(packed, scratch);
    const firstPlan = first.plan;
    const firstDescriptor = first.plan?.descriptor;
    const firstSource = first.plan?.source;
    const firstDiagnostics = first.diagnostics;
    const second = writeWorldTransformBufferDescriptor(packed, scratch);

    expect(first.plan?.descriptor.size).toBe(32 * 4);
    expect(first.plan?.source.byteLength).toBe(32 * 4);
    expect(second).toBe(first);
    expect(second.plan).toBe(firstPlan);
    expect(second.plan?.descriptor).toBe(firstDescriptor);
    expect(second.plan?.source).toBe(firstSource);
    expect(second.diagnostics).toBe(firstDiagnostics);
  });

  it("reports empty transform data and buffer creation failures", () => {
    const empty = createWorldTransformBufferDescriptor({
      data: new Float32Array(0),
      offsets: [],
      diagnostics: [],
    });
    const validPlan = required(
      createWorldTransformBufferDescriptor(packedTransforms(1)).plan,
    );
    const invalidPlan: WorldTransformBufferDescriptorPlan = {
      ...validPlan,
      descriptor: { ...validPlan.descriptor, size: 0 },
    };

    expect(empty.plan).toBeNull();
    expect(empty.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "worldTransformBuffer.emptyData",
    ]);
    expect(
      createWorldTransformGpuBuffer({
        device: deviceWithBuffers([]),
        plan: null,
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "worldTransformGpuBuffer.nullDescriptorPlan" }],
    });
    expect(
      createWorldTransformGpuBuffer({
        device: deviceWithBuffers([]),
        plan: invalidPlan,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["worldTransformGpuBuffer.creationFailed"]);
  });
});

function packedTransforms(count: number): PackedSnapshotTransforms {
  return {
    data: identityMatrices(count),
    offsets: Array.from({ length: count }, (_, index) => ({
      renderId: index + 1,
      sourceOffset: index * 16,
      packedOffset: index * 16,
    })),
    diagnostics: [],
  };
}

function identityMatrices(count: number): Float32Array {
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return data;
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
