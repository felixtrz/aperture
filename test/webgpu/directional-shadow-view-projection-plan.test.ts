import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowViewProjectionPlanReport,
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  directionalShadowViewProjectionPlanReportToJson,
  directionalShadowViewProjectionPlanReportToJsonValue,
  type LightPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("directional shadow view-projection planning", () => {
  it("plans JSON-safe directional shadow matrix keys without computing matrices", () => {
    const report = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      lights: [light(11, "directional")],
      shadowPassPlan: shadowPassPlan(),
    });
    const json = directionalShadowViewProjectionPlanReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      requestCount: 1,
      passCount: 1,
      planCount: 1,
      sections: {
        shadowRequests: true,
        lightPackets: true,
        passPlans: true,
        matrixPlanning: false,
        gpuResources: false,
      },
      plans: [
        {
          shadowId: 7,
          lightId: 11,
          planKey: "directional-shadow-view-projection:7:light:11",
          passKey: "shadow-pass:7:light:11",
          lightKind: "directional",
          cascadeIndex: 0,
          cascadeCount: 1,
          cascadeNear: 0,
          cascadeFar: 1,
          cascadeNearDistance: 0.1,
          cascadeFarDistance: 10,
          lightTransformOffset: 64,
          mapSize: 1024,
          casterLayerMask: 1,
          receiverLayerMask: 2,
          projection: "orthographic",
          viewMatrixKey: "shadow-pass:7:light:11:view",
          projectionMatrixKey: "shadow-pass:7:light:11:projection",
          viewProjectionMatrixKey: "shadow-pass:7:light:11:view-projection",
          computation: "deferred",
        },
      ],
      diagnostics: [
        {
          code: "directionalShadowViewProjection.matrixDeferred",
          severity: "warning",
          shadowId: 7,
          lightId: 11,
          message:
            "Directional shadow view/projection keys are planned, but matrix computation is not implemented yet.",
        },
      ],
    });
    expect(
      JSON.parse(directionalShadowViewProjectionPlanReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPU|Object3D|GraphNode|raw/);
  });

  it("plans stable keys and normalized split bounds for each directional cascade", () => {
    const request = { ...shadowRequest(7, 11), cascadeCount: 3 };
    const report = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests: [request],
      lights: [light(11, "directional")],
      shadowPassPlan: shadowPassPlan(request),
    });
    const json = directionalShadowViewProjectionPlanReportToJsonValue(report);

    expect(json.planCount).toBe(3);
    expect(json.plans.map((plan) => plan.planKey)).toEqual([
      "directional-shadow-view-projection:7:light:11:cascade:0",
      "directional-shadow-view-projection:7:light:11:cascade:1",
      "directional-shadow-view-projection:7:light:11:cascade:2",
    ]);
    expect(
      json.plans.map((plan) => [
        plan.cascadeIndex,
        plan.cascadeNear,
        plan.cascadeFar,
      ]),
    ).toEqual([
      [0, 0, 1 / 3],
      [1, 1 / 3, 2 / 3],
      [2, 2 / 3, 1],
    ]);
  });

  it("emits practical (linear/log blended) absolute cascade far distances, not index/count linear", () => {
    const request = { ...shadowRequest(7, 11), cascadeCount: 4 };
    const report = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests: [request],
      lights: [light(11, "directional")],
      shadowPassPlan: shadowPassPlan(request),
      shadowMaxDistance: 100,
    });
    const json = directionalShadowViewProjectionPlanReportToJsonValue(report);

    const farDistances = json.plans.map((plan) => plan.cascadeFarDistance);

    expect(farDistances).toHaveLength(4);
    expect(farDistances).toEqual(expectedPracticalFarBounds(4, 100));

    // The far cascade must be the full shadow max distance.
    expect(farDistances[3]).toBe(100);

    // The split must NOT be the old index/count linear scheme (which would be
    // [25, 50, 75, 100] for max distance 100).
    expect(farDistances).not.toEqual([25, 50, 75, 100]);
  });

  it("emits contiguous cascade coverage: cascade N near equals cascade N-1 far", () => {
    const request = { ...shadowRequest(7, 11), cascadeCount: 4 };
    const report = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests: [request],
      lights: [light(11, "directional")],
      shadowPassPlan: shadowPassPlan(request),
      shadowMaxDistance: 100,
    });
    const json = directionalShadowViewProjectionPlanReportToJsonValue(report);

    for (let index = 1; index < json.plans.length; index += 1) {
      expect(json.plans[index]?.cascadeNearDistance).toBe(
        json.plans[index - 1]?.cascadeFarDistance,
      );
    }
  });

  it("reports missing light or unsupported light kind", () => {
    const missing = directionalShadowViewProjectionPlanReportToJsonValue(
      createDirectionalShadowViewProjectionPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        lights: [],
        shadowPassPlan: shadowPassPlan(),
      }),
    );
    const unsupported = directionalShadowViewProjectionPlanReportToJsonValue(
      createDirectionalShadowViewProjectionPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        lights: [light(11, "point")],
        shadowPassPlan: shadowPassPlan(),
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.planCount).toBe(0);
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "directionalShadowViewProjection.missingLight",
    ]);
    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.planCount).toBe(0);
    expect(
      unsupported.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["directionalShadowViewProjection.unsupportedLightKind"]);
  });
});

// Independent replication of the practical (linear/log blended) far-bound
// formula used by light-packing `directionalCascadeFarBounds`. The plan's
// absolute far distances must match this exactly so the shader-side cascade
// SELECTION agrees with the matrix-side fit.
function expectedPracticalFarBounds(
  cascadeCount: number,
  shadowMaxDistance: number,
): number[] {
  const max = Math.max(1, shadowMaxDistance);
  const min = Math.min(0.1, max * 0.5);
  const bounds: number[] = [];

  for (let index = 0; index < cascadeCount; index += 1) {
    const fraction = (index + 1) / cascadeCount;
    const linear = min + (max - min) * fraction;
    const logarithmic = min * Math.pow(max / min, fraction);
    bounds.push(
      index + 1 === cascadeCount ? max : (linear + logarithmic) * 0.5,
    );
  }

  return bounds;
}

function shadowPassPlan(request: ShadowRequestPacket = shadowRequest(7, 11)) {
  return createShadowPassPlanReport({
    shadowRequests: [request],
    textures: createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [request],
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
