import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowViewProjectionPlanReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  shadowMatrixBufferDescriptorReportToJson,
  shadowMatrixBufferDescriptorReportToJsonValue,
  type LightPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu";

describe("shadow matrix buffer descriptor planning", () => {
  it("plans JSON-safe matrix buffer descriptors without allocating GPU buffers", () => {
    const report = createShadowMatrixBufferDescriptorReport({
      viewProjection: viewProjectionPlan(),
    });
    const json = shadowMatrixBufferDescriptorReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      planCount: 1,
      matrixCount: 1,
      byteSize: 64,
      sections: {
        viewProjectionPlanning: true,
        bufferDescriptor: true,
        gpuAllocation: false,
        upload: false,
      },
      descriptor: {
        resourceKey: "shadow-matrix-buffer:directional",
        label: "DirectionalShadowMatrices/storage",
        usage: "read-only-storage-buffer",
        matrixCount: 1,
        strideBytes: 64,
        byteSize: 64,
        entries: [
          {
            shadowId: 7,
            lightId: 11,
            planKey: "directional-shadow-view-projection:7:light:11",
            passKey: "shadow-pass:7:light:11",
            matrixKey: "shadow-pass:7:light:11:view-projection",
            offsetBytes: 0,
            sizeBytes: 64,
            upload: "deferred",
          },
        ],
      },
      diagnostics: [
        {
          code: "shadowMatrixBuffer.uploadDeferred",
          severity: "warning",
          message:
            "Shadow matrix buffer descriptor is planned, but GPU buffer allocation and matrix upload are deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowMatrixBufferDescriptorReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUBuffer|GPUCommandEncoder|GPURenderPass|"raw"/,
    );
  });

  it("reports not-required when no shadow view/projection planning is needed", () => {
    const json = shadowMatrixBufferDescriptorReportToJsonValue(
      createShadowMatrixBufferDescriptorReport({
        viewProjection: createDirectionalShadowViewProjectionPlanReport({
          shadowRequests: [],
          lights: [],
          shadowPassPlan: createShadowPassPlanReport({
            shadowRequests: [],
            textures: createShadowTextureResourceReport({
              descriptors: createShadowMapDescriptorReport({
                shadowRequests: [],
                descriptors: [],
              }),
            }),
          }),
        }),
      }),
    );

    expect(json.status).toBe("not-required");
    expect(json.ready).toBe(true);
    expect(json.descriptor).toBeNull();
    expect(json.sections.upload).toBe(true);
  });

  it("reports missing and unsupported view/projection prerequisites", () => {
    const missing = shadowMatrixBufferDescriptorReportToJsonValue(
      createShadowMatrixBufferDescriptorReport({
        viewProjection: createDirectionalShadowViewProjectionPlanReport({
          shadowRequests: [shadowRequest(7, 11)],
          lights: [],
          shadowPassPlan: shadowPassPlan(),
        }),
      }),
    );
    const unsupported = shadowMatrixBufferDescriptorReportToJsonValue(
      createShadowMatrixBufferDescriptorReport({
        viewProjection: createDirectionalShadowViewProjectionPlanReport({
          shadowRequests: [shadowRequest(7, 11)],
          lights: [light(11, "point")],
          shadowPassPlan: shadowPassPlan(),
        }),
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.descriptor).toBeNull();
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowMatrixBuffer.missingViewProjectionPlan",
    ]);
    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.sections.viewProjectionPlanning).toBe(false);
    expect(
      unsupported.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["shadowMatrixBuffer.unsupportedViewProjectionPlan"]);
  });

  it("can classify descriptors as ready when matrix upload is ready", () => {
    const json = shadowMatrixBufferDescriptorReportToJsonValue(
      createShadowMatrixBufferDescriptorReport({
        viewProjection: viewProjectionPlan("ready"),
        upload: "ready",
      }),
    );

    expect(json.ready).toBe(true);
    expect(json.status).toBe("ready");
    expect(json.sections.upload).toBe(true);
    expect(json.descriptor?.entries[0]?.upload).toBe("ready");
    expect(json.diagnostics).toEqual([]);
  });
});

function viewProjectionPlan(computation: "ready" | "deferred" = "deferred") {
  return createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest(7, 11)],
    lights: [light(11, "directional")],
    shadowPassPlan: shadowPassPlan(),
    computation,
  });
}

function shadowPassPlan() {
  return createShadowPassPlanReport({
    shadowRequests: [shadowRequest(7, 11)],
    textures: createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest(7, 11)],
        descriptors: [
          {
            shadowId: 7,
            lightId: 11,
            mapSize: 1024,
            depthBias: 0.001,
          },
        ],
      }),
    }),
  });
}

function shadowRequest(shadowId: number, lightId: number): ShadowRequestPacket {
  return {
    shadowId,
    lightId,
    casterLayerMask: 1,
    receiverLayerMask: 2,
  };
}

function light(lightId: number, kind: LightPacket["kind"]): LightPacket {
  return {
    lightId,
    entity: { index: lightId, generation: 0 },
    kind,
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 64,
    layerMask: 1,
  };
}
