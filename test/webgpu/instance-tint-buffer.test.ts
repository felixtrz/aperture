import { describe, expect, it } from "vitest";

import {
  INSTANCE_TINT_VERTEX_BUFFER_LAYOUT,
  createInstanceTintBufferDescriptor,
  createInstanceTintGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";
import type { PackedSnapshotInstanceTints } from "@aperture-engine/render";

describe("instance tint vertex buffer resources", () => {
  it("creates an instance-rate vec4 vertex buffer descriptor", () => {
    const result = createInstanceTintBufferDescriptor({
      data: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
      floatCount: 8,
      offsets: [
        { renderId: 1, sourceOffset: 0, packedOffset: 0 },
        { renderId: 2, sourceOffset: 4, packedOffset: 4 },
      ],
      diagnostics: [],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      descriptor: {
        label: "InstanceTints/vertex",
        size: 32,
      },
      vertexCount: 2,
    });
    expect(INSTANCE_TINT_VERTEX_BUFFER_LAYOUT).toMatchObject({
      arrayStride: 16,
      stepMode: "instance",
      attributes: [{ shaderLocation: 6, offset: 0, format: "float32x4" }],
    });
  });

  it("creates a GPU resource without exposing raw handles in diagnostics", () => {
    const created: unknown[] = [];
    const result = createInstanceTintGpuBuffer({
      device: deviceWithBuffers(created),
      plan: required(createInstanceTintBufferDescriptor(packedTints()).plan),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      streamId: "instanceTint",
      resourceKey: "instance-tint-buffer:InstanceTints/vertex",
      vertexCount: 2,
    });
    expect(created).toHaveLength(1);
    expect(JSON.stringify(result.diagnostics)).not.toMatch(/GPUBuffer|raw/u);
  });

  it("diagnoses empty or invalid packed tint input", () => {
    expect(
      createInstanceTintBufferDescriptor({
        data: new Float32Array(0),
        floatCount: 0,
        offsets: [],
        diagnostics: [],
      }).diagnostics,
    ).toMatchObject([{ code: "instanceTintBuffer.emptyData" }]);

    expect(
      createInstanceTintBufferDescriptor({
        data: new Float32Array([1, 0, 0, 1]),
        floatCount: 4,
        offsets: [{ renderId: 1, sourceOffset: 0, packedOffset: 0 }],
        diagnostics: [
          {
            code: "renderInstanceTintPack.missingTint",
            message: "missing",
            severity: "warning",
          },
        ],
      }).diagnostics,
    ).toMatchObject([
      {
        code: "instanceTintBuffer.packDiagnostic",
        sourceCode: "renderInstanceTintPack.missingTint",
      },
    ]);
  });
});

function packedTints(): PackedSnapshotInstanceTints {
  return {
    data: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
    floatCount: 8,
    offsets: [
      { renderId: 1, sourceOffset: 0, packedOffset: 0 },
      { renderId: 2, sourceOffset: 4, packedOffset: 4 },
    ],
    diagnostics: [],
  };
}

function deviceWithBuffers(created: unknown[]): WebGpuBufferDeviceLike {
  return {
    queue: { writeBuffer: () => {} },
    createBuffer: (descriptor) => {
      const buffer = { descriptor };
      created.push(buffer);
      return buffer;
    },
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected value to be present.");
  }

  return value;
}
