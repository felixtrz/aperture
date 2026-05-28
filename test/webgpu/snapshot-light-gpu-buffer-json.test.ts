import { describe, expect, it } from "vitest";

import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  createSnapshotLightGpuBuffers,
  createSnapshotLightGpuBuffersResultToJson,
  createSnapshotLightGpuBuffersResultToJsonValue,
  type LightPacket,
  type RenderSnapshot,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("snapshot light GPU buffer JSON helpers", () => {
  it("serializes empty no-op snapshot light GPU buffer results", () => {
    const result = createSnapshotLightGpuBuffers(snapshot({}), {
      device: deviceWithRawBuffers(),
    });

    expect(createSnapshotLightGpuBuffersResultToJsonValue(result)).toEqual({
      valid: true,
      lightBuffer: {
        resourceKey: "light-buffer:main",
        usageIntent: "read-only-storage",
        count: 0,
        byteLength: 0,
        floatByteLength: 0,
        metadataByteLength: 0,
      },
      descriptorPlan: { present: false },
      resource: null,
      counts: {
        plannedLights: 0,
        plannedGpuBuffers: 0,
        createdLights: 0,
        createdGpuBuffers: 0,
        diagnostics: 0,
      },
      diagnostics: [],
    });
  });

  it("serializes successful snapshot light GPU buffer creation without raw handles", () => {
    const result = createSnapshotLightGpuBuffers(
      snapshot({ lights: [light("directional", 1)] }),
      {
        device: deviceWithRawBuffers(),
        lightBuffer: { resourceKey: "light-buffer:snapshot" },
      },
    );

    const value = createSnapshotLightGpuBuffersResultToJsonValue(result);
    const json = createSnapshotLightGpuBuffersResultToJson(result);

    expect(value).toEqual({
      valid: true,
      lightBuffer: {
        resourceKey: "light-buffer:snapshot",
        usageIntent: "read-only-storage",
        count: 1,
        byteLength:
          PACKED_LIGHT_FLOAT_STRIDE * Float32Array.BYTES_PER_ELEMENT +
          PACKED_LIGHT_METADATA_STRIDE * Int32Array.BYTES_PER_ELEMENT,
        floatByteLength:
          PACKED_LIGHT_FLOAT_STRIDE * Float32Array.BYTES_PER_ELEMENT,
        metadataByteLength:
          PACKED_LIGHT_METADATA_STRIDE * Int32Array.BYTES_PER_ELEMENT,
      },
      descriptorPlan: {
        present: true,
        resourceKey: "light-buffer:snapshot",
        floatByteLength:
          PACKED_LIGHT_FLOAT_STRIDE * Float32Array.BYTES_PER_ELEMENT,
        metadataByteLength:
          PACKED_LIGHT_METADATA_STRIDE * Int32Array.BYTES_PER_ELEMENT,
      },
      resource: {
        resourceKey: "light-buffer:snapshot",
        floatResourceKey: "light-buffer:snapshot/floats",
        metadataResourceKey: "light-buffer:snapshot/metadata",
        count: 1,
      },
      counts: {
        plannedLights: 1,
        plannedGpuBuffers: 2,
        createdLights: 1,
        createdGpuBuffers: 2,
        diagnostics: 0,
      },
      diagnostics: [],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(createSnapshotLightGpuBuffersResultToJson(result));
    expect(json).not.toContain("raw-light-float-buffer");
    expect(json).not.toContain("raw-light-metadata-buffer");
    expect(json).not.toContain("Float32Array");
    expect(json).not.toContain("Int32Array");
    expect(json).not.toContain("floatBuffer");
    expect(json).not.toContain("metadataBuffer");
    expect(json).not.toContain('"floats":');
    expect(json).not.toContain('"metadata":');
  });

  it("serializes descriptor-plan diagnostics", () => {
    const value = createSnapshotLightGpuBuffersResultToJsonValue(
      createSnapshotLightGpuBuffers(snapshot({ lights: [light("spot", 2)] }), {
        device: deviceWithRawBuffers(),
        descriptorPlan: { usage: 0 },
      }),
    );

    expect(value).toMatchObject({
      valid: false,
      descriptorPlan: { present: false },
      resource: null,
      counts: {
        plannedLights: 1,
        plannedGpuBuffers: 0,
        createdLights: 0,
        createdGpuBuffers: 0,
        diagnostics: 1,
      },
      diagnostics: [
        {
          code: "lightBufferDescriptor.invalidUsageFlags",
          field: "usage",
          message: "Light buffer usage flags must be a positive integer.",
        },
      ],
    });
  });

  it("serializes light GPU buffer creation diagnostics", () => {
    const value = createSnapshotLightGpuBuffersResultToJsonValue(
      createSnapshotLightGpuBuffers(snapshot({ lights: [light("point", 3)] }), {
        device: deviceWithoutCreateBuffer(),
        lightBuffer: { resourceKey: "light-buffer:no-device" },
      }),
    );

    expect(value).toMatchObject({
      valid: false,
      descriptorPlan: {
        present: true,
        resourceKey: "light-buffer:no-device",
      },
      resource: null,
      counts: {
        plannedLights: 1,
        plannedGpuBuffers: 2,
        createdLights: 0,
        createdGpuBuffers: 0,
        diagnostics: 2,
      },
      diagnostics: [
        {
          code: "lightGpuBuffer.creationFailed",
          reason: "create-buffer-unavailable",
          resourceKey: "light-buffer:no-device/floats",
        },
        {
          code: "lightGpuBuffer.creationFailed",
          reason: "create-buffer-unavailable",
          resourceKey: "light-buffer:no-device/metadata",
        },
      ],
    });
  });
});

function snapshot(input: {
  readonly lights?: readonly LightPacket[];
}): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: input.lights ?? [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: input.lights?.length ?? 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function light(kind: LightPacket["kind"], seed: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind,
    color: [1, 1, 1, 1],
    intensity: seed,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 16 * seed,
    layerMask: 1,
  };
}

function deviceWithRawBuffers(): WebGpuBufferDeviceLike {
  const handles = ["raw-light-float-buffer", "raw-light-metadata-buffer"];

  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: () => ({ handle: handles.shift() ?? "raw-light-buffer" }),
  };
}

function deviceWithoutCreateBuffer(): WebGpuBufferDeviceLike {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
  };
}
