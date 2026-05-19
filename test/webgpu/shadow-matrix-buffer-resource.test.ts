import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  shadowMatrixBufferResourceReportToJson,
  shadowMatrixBufferResourceReportToJsonValue,
  type LightPacket,
  type ShadowRequestPacket,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("shadow matrix buffer resources", () => {
  it("allocates, uploads, and reuses renderer-owned shadow matrix buffers", () => {
    const createdBuffers: unknown[] = [];
    const writes: unknown[] = [];
    const device = deviceWithBuffers(createdBuffers, writes);
    const viewProjection = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests: [shadowRequest()],
      lights: [light()],
      shadowPassPlan: createShadowPassPlanReport({
        shadowRequests: [shadowRequest()],
        textures: createShadowTextureResourceReport({
          descriptors: createShadowMapDescriptorReport({
            shadowRequests: [shadowRequest()],
            descriptors: [
              { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
            ],
          }),
        }),
      }),
    });
    const matrices = createDirectionalShadowMatrixComputationReport({
      viewProjection,
      transforms: identityTransform(),
    });
    const descriptor = createShadowMatrixBufferDescriptorReport({
      viewProjection,
      upload: "ready",
    });
    const cache = new Map();

    const first = createShadowMatrixBufferResourceReport({
      device,
      descriptor,
      matrices,
      cache,
    });
    const second = createShadowMatrixBufferResourceReport({
      device,
      descriptor,
      matrices,
      cache,
    });
    const json = shadowMatrixBufferResourceReportToJsonValue(second);

    expect(first.createdBufferCount).toBe(1);
    expect(first.reusedBufferCount).toBe(0);
    expect(second.createdBufferCount).toBe(0);
    expect(second.reusedBufferCount).toBe(1);
    expect(json).toMatchObject({
      ready: true,
      status: "available",
      matrixCount: 1,
      byteSize: 64,
      createdBufferCount: 0,
      reusedBufferCount: 1,
      sections: {
        matrixComputation: true,
        bufferDescriptor: true,
        bufferAllocation: true,
        upload: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      resource: {
        resourceKey: "shadow-matrix-buffer:directional",
        label: "DirectionalShadowMatrices/storage",
        byteSize: 64,
        matrixCount: 1,
        entryMatrixKeys: ["shadow-pass:7:light:11:view-projection"],
      },
      diagnostics: [
        {
          code: "shadowMatrixBufferResource.bindGroupDeferred",
          severity: "warning",
        },
        {
          code: "shadowMatrixBufferResource.shaderSamplingDeferred",
          severity: "warning",
        },
      ],
    });
    expect(JSON.parse(shadowMatrixBufferResourceReportToJson(second))).toEqual(
      json,
    );
    expect(createdBuffers).toHaveLength(1);
    expect(writes).toHaveLength(1);
    expect(JSON.stringify(json)).not.toMatch(/GPUBuffer|writeBuffer|"raw"/);
  });

  it("reports missing matrix data and unavailable buffer upload support", () => {
    const viewProjection = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests: [shadowRequest()],
      lights: [light()],
      shadowPassPlan: createShadowPassPlanReport({
        shadowRequests: [shadowRequest()],
        textures: createShadowTextureResourceReport({
          descriptors: createShadowMapDescriptorReport({
            shadowRequests: [shadowRequest()],
            descriptors: [
              { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
            ],
          }),
        }),
      }),
    });
    const descriptor = createShadowMatrixBufferDescriptorReport({
      viewProjection,
      upload: "ready",
    });
    const missingMatrixData = shadowMatrixBufferResourceReportToJsonValue(
      createShadowMatrixBufferResourceReport({
        device: deviceWithBuffers([], []),
        descriptor,
        matrices: createDirectionalShadowMatrixComputationReport({
          viewProjection,
          transforms: new Float32Array(0),
        }),
      }),
    );
    const missingQueue = shadowMatrixBufferResourceReportToJsonValue(
      createShadowMatrixBufferResourceReport({
        device: { createBuffer: () => ({}) },
        descriptor,
        matrices: createDirectionalShadowMatrixComputationReport({
          viewProjection,
          transforms: identityTransform(),
        }),
      }),
    );

    expect(missingMatrixData.status).toBe("missing");
    expect(missingMatrixData.diagnostics[0]?.code).toBe(
      "shadowMatrixBufferResource.missingMatrices",
    );
    expect(missingQueue.status).toBe("missing");
    expect(missingQueue.diagnostics[0]).toMatchObject({
      code: "shadowMatrixBufferResource.bufferCreationFailed",
      reason: "queue-write-buffer-unavailable",
    });
  });
});

function shadowRequest(): ShadowRequestPacket {
  return {
    shadowId: 7,
    lightId: 11,
    casterLayerMask: 1,
    receiverLayerMask: 2,
  };
}

function light(): LightPacket {
  return {
    lightId: 11,
    entity: { index: 1, generation: 0 },
    kind: "directional",
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 0,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function deviceWithBuffers(
  createdBuffers: unknown[],
  writes: unknown[],
): WebGpuBufferDeviceLike {
  return {
    createBuffer: (descriptor) => {
      createdBuffers.push(descriptor);
      return { descriptor };
    },
    queue: {
      writeBuffer: (...args) => {
        writes.push(args);
      },
    },
  };
}
