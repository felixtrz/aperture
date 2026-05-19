import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  directionalShadowMatrixComputationReportToJson,
  directionalShadowMatrixComputationReportToJsonValue,
  type LightPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu";

describe("directional shadow matrix computation", () => {
  it("computes JSON-safe view/projection matrices from extracted light transforms", () => {
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: viewProjection(),
      transforms: identityTransform(),
      center: [0, 0, 0],
      orthographicSize: 10,
      near: 1,
      far: 51,
      lightDistance: 25,
    });
    const json = directionalShadowMatrixComputationReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.status).toBe("ready");
    expect(json.planCount).toBe(1);
    expect(json.matrixCount).toBe(1);
    expect(json.sections).toEqual({
      viewProjectionPlanning: true,
      transformData: true,
      matrixComputation: true,
      gpuBufferAllocation: false,
      upload: false,
      passSubmission: false,
    });
    expect(json.matrices).toHaveLength(1);
    expect(json.matrices[0]).toMatchObject({
      shadowId: 7,
      lightId: 11,
      planKey: "directional-shadow-view-projection:7:light:11",
      passKey: "shadow-pass:7:light:11",
      matrixKey: "shadow-pass:7:light:11:view-projection",
      lightTransformOffset: 0,
      center: [0, 0, 0],
      lightDirection: [0, 0, -1],
      lightPosition: [0, 0, 25],
      orthographicSize: 10,
      near: 1,
      far: 51,
    });
    expect(json.matrices[0]?.viewMatrix).toHaveLength(16);
    expect(json.matrices[0]?.projectionMatrix).toHaveLength(16);
    expect(json.matrices[0]?.viewProjectionMatrix).toHaveLength(16);
    expect(json.matrices[0]?.viewProjectionMatrix.every(Number.isFinite)).toBe(
      true,
    );
    expect(json.diagnostics).toEqual([]);
    expect(
      JSON.parse(directionalShadowMatrixComputationReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUBuffer|GPUTexture|raw/);
  });

  it("reports missing light transform data", () => {
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: viewProjection(),
      transforms: new Float32Array(0),
    });
    const json = directionalShadowMatrixComputationReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      planCount: 1,
      matrixCount: 0,
      sections: {
        viewProjectionPlanning: true,
        transformData: false,
        matrixComputation: false,
      },
      diagnostics: [
        {
          code: "directionalShadowMatrix.missingLightTransform",
          severity: "warning",
          shadowId: 7,
          lightId: 11,
        },
      ],
    });
  });
});

function viewProjection() {
  return createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest()],
    lights: [light()],
    shadowPassPlan: createShadowPassPlanReport({
      shadowRequests: [shadowRequest()],
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [shadowRequest()],
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
    }),
  });
}

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
