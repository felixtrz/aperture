import { describe, expect, it } from "vitest";

import {
  createLightBufferDescriptor,
  createLightBufferDescriptorPlan,
  createLightGpuBuffers,
  createLightGpuBuffersResultToJson,
  createLightGpuBuffersResultToJsonValue,
  type LightPacket,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("light GPU buffer resource JSON helpers", () => {
  it("serializes valid light GPU buffer resources without raw handles", () => {
    const result = createLightGpuBuffers({
      device: deviceWithRawBuffers(),
      plan: required(
        createLightBufferDescriptorPlan(
          createLightBufferDescriptor(
            [light("directional", 1), light("point", 2)],
            { resourceKey: "light-buffer:json" },
          ),
        ).plan,
      ),
    });

    const value = createLightGpuBuffersResultToJsonValue(result);
    const json = createLightGpuBuffersResultToJson(result);

    expect(value).toEqual({
      valid: true,
      resource: {
        resourceKey: "light-buffer:json",
        floatResourceKey: "light-buffer:json/floats",
        metadataResourceKey: "light-buffer:json/metadata",
        count: 2,
      },
      counts: {
        lights: 2,
        gpuBuffers: 2,
        diagnostics: 0,
      },
      diagnostics: [],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(createLightGpuBuffersResultToJson(result));
    expect(json).not.toContain("raw-light-float-buffer");
    expect(json).not.toContain("raw-light-metadata-buffer");
    expect(json).not.toContain("floatBuffer");
    expect(json).not.toContain("metadataBuffer");
  });

  it("serializes null descriptor plan diagnostics", () => {
    const value = createLightGpuBuffersResultToJsonValue(
      createLightGpuBuffers({
        device: deviceWithRawBuffers(),
        plan: null,
      }),
    );

    expect(value).toEqual({
      valid: false,
      resource: null,
      counts: {
        lights: 0,
        gpuBuffers: 0,
        diagnostics: 1,
      },
      diagnostics: [
        {
          code: "lightGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create light GPU buffers from a null descriptor plan.",
        },
      ],
    });
  });

  it("serializes creation failure diagnostics with stable resource keys", () => {
    const plan = required(
      createLightBufferDescriptorPlan(
        createLightBufferDescriptor([light("spot", 3)], {
          resourceKey: "light-buffer:failed",
        }),
      ).plan,
    );
    const result = createLightGpuBuffers({
      device: deviceWithRawBuffers(),
      plan: {
        ...plan,
        floatDescriptor: { ...plan.floatDescriptor, size: 0 },
        metadataDescriptor: { ...plan.metadataDescriptor, size: 0 },
      },
    });

    const value = createLightGpuBuffersResultToJsonValue(result);
    const json = createLightGpuBuffersResultToJson(result);

    expect(value).toEqual({
      valid: false,
      resource: null,
      counts: {
        lights: 0,
        gpuBuffers: 0,
        diagnostics: 2,
      },
      diagnostics: [
        {
          code: "lightGpuBuffer.creationFailed",
          message:
            "Failed to create light float buffer 'light-buffer:failed/floats': WebGPU buffer size must be a positive finite number.",
          reason: "invalid-size",
          resourceKey: "light-buffer:failed/floats",
        },
        {
          code: "lightGpuBuffer.creationFailed",
          message:
            "Failed to create light metadata buffer 'light-buffer:failed/metadata': WebGPU buffer size must be a positive finite number.",
          reason: "invalid-size",
          resourceKey: "light-buffer:failed/metadata",
        },
      ],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).not.toContain("raw-light");
  });
});

function light(kind: LightPacket["kind"], seed: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind,
    color: [1, 0.75, 0.5, 1],
    intensity: 10 * seed,
    range: 20 * seed,
    innerConeAngle: 0.125 * seed,
    outerConeAngle: 0.25 * seed,
    worldTransformOffset: 16 * seed,
    layerMask: 1 << seed,
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

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
