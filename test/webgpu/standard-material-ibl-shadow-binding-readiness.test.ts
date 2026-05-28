import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowViewProjectionPlanReport,
  createEnvironmentMapHandle,
  createIblPreparationPassPlanReport,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  createMaterialHandle,
  createMeshHandle,
  createShadowCasterDrawListPlanReport,
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  createStandardMaterialIblShadowBindingReadinessReport,
  standardMaterialIblShadowBindingReadinessReportToJson,
  standardMaterialIblShadowBindingReadinessReportToJsonValue,
  type EnvironmentPacket,
  type LightPacket,
  type MeshDrawPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial IBL/shadow binding readiness", () => {
  it("reports metadata-only binding slots as deferred", () => {
    const report = createStandardMaterialIblShadowBindingReadinessReport({
      standardMaterialCount: 2,
      iblPassPlan: iblPassPlan(),
      shadowViewProjection: shadowViewProjection(),
      shadowCasterDrawList: shadowCasterDrawList(),
    });
    const json =
      standardMaterialIblShadowBindingReadinessReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.status).toBe("deferred");
    expect(json.slotCount).toBe(4);
    expect(json.sections).toEqual({
      iblPassPlanning: true,
      shadowPlanning: true,
      bindGroupLayout: false,
      shaderSampling: false,
    });
    expect(json.slots.map((slot) => slot.kind)).toEqual([
      "ibl-diffuse",
      "ibl-specular",
      "shadow-view-projection",
      "shadow-map",
    ]);
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialIblShadowBinding.bindGroupDeferred",
      "standardMaterialIblShadowBinding.shaderSamplingDeferred",
    ]);
    expect(
      JSON.parse(standardMaterialIblShadowBindingReadinessReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUBindGroup|GPUShaderModule|callback|"raw"/,
    );
  });

  it("reports missing prerequisites and no StandardMaterial as not required", () => {
    const missing = standardMaterialIblShadowBindingReadinessReportToJsonValue(
      createStandardMaterialIblShadowBindingReadinessReport({
        standardMaterialCount: 1,
        iblPassPlan: createIblPreparationPassPlanReport({
          textures: createIblTexturePreparationReport({
            descriptors: createIblResourceDescriptorReport({
              snapshot: [environment()],
              descriptors: [],
            }),
          }),
        }),
        shadowViewProjection: createDirectionalShadowViewProjectionPlanReport({
          shadowRequests: [shadowRequest()],
          lights: [],
          shadowPassPlan: shadowPassPlan(),
        }),
        shadowCasterDrawList: shadowCasterDrawList(),
      }),
    );
    const notRequired =
      standardMaterialIblShadowBindingReadinessReportToJsonValue(
        createStandardMaterialIblShadowBindingReadinessReport({
          standardMaterialCount: 0,
          iblPassPlan: iblPassPlan(),
          shadowViewProjection: shadowViewProjection(),
          shadowCasterDrawList: shadowCasterDrawList(),
        }),
      );

    expect(missing.status).toBe("missing");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialIblShadowBinding.missingIblPlan",
      "standardMaterialIblShadowBinding.missingShadowPlan",
    ]);
    expect(notRequired).toMatchObject({
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      slotCount: 0,
      diagnostics: [],
    });
  });
});

function iblPassPlan() {
  return createIblPreparationPassPlanReport({
    textures: createIblTexturePreparationReport({
      descriptors: createIblResourceDescriptorReport({
        snapshot: [environment()],
        descriptors: [
          {
            environmentMapResourceKey: "environment-map:studio",
            diffuseResourceKey: "texture:studio:diffuse",
            specularResourceKey: "texture:studio:specular",
          },
        ],
      }),
    }),
  });
}

function shadowViewProjection() {
  return createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest()],
    lights: [light()],
    shadowPassPlan: shadowPassPlan(),
  });
}

function shadowCasterDrawList() {
  return createShadowCasterDrawListPlanReport({
    shadowRequests: [shadowRequest()],
    meshDraws: [meshDraw()],
    shadowPassPlan: shadowPassPlan(),
  });
}

function shadowPassPlan() {
  return createShadowPassPlanReport({
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
  });
}

function environment(): EnvironmentPacket {
  return {
    environmentId: 1,
    handle: createEnvironmentMapHandle("studio"),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}

function shadowRequest(): ShadowRequestPacket {
  return {
    shadowId: 7,
    lightId: 11,
    casterLayerMask: 1,
    receiverLayerMask: 1,
  };
}

function light(): LightPacket {
  return {
    lightId: 11,
    entity: { index: 11, generation: 0 },
    kind: "directional",
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 64,
    layerMask: 1,
  };
}

function meshDraw(): MeshDrawPacket {
  return {
    renderId: 1,
    entity: { index: 1, generation: 0 },
    mesh: createMeshHandle("mesh-1"),
    material: createMaterialHandle("material-1"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "standard",
      materialKey: "material-1",
      meshKey: "mesh-1",
      depth: 0,
      stableId: 1,
    },
    batchKey: {
      pipelineKey: "standard",
      materialKey: "material-1",
      meshLayoutKey: "mesh-1",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}
