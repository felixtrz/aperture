import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createShadowCasterDrawListPlanReport,
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  shadowCasterDrawListPlanReportToJson,
  shadowCasterDrawListPlanReportToJsonValue,
  type MeshDrawPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster draw-list planning", () => {
  it("filters mesh draws by caster layer and keeps command encoding deferred", () => {
    const report = createShadowCasterDrawListPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      meshDraws: [meshDraw(1, 1), meshDraw(2, 4)],
      shadowPassPlan: shadowPassPlan(),
    });
    const json = shadowCasterDrawListPlanReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      requestCount: 1,
      meshDrawCount: 2,
      listCount: 1,
      includedDrawCount: 1,
      skippedDrawCount: 1,
      sections: {
        shadowRequests: true,
        passPlans: true,
        casterFiltering: true,
        commandEncoding: false,
      },
      lists: [
        {
          shadowId: 7,
          lightId: 11,
          passKey: "shadow-pass:7:light:11",
          casterLayerMask: 1,
          receiverLayerMask: 2,
          includedDrawCount: 1,
          skippedDrawCount: 1,
          commandEncoding: "deferred",
          draws: [
            {
              renderId: 1,
              meshKey: "mesh:mesh-1",
              materialKey: "material:material-1",
              meshLayoutKey: "mesh-1",
              submesh: 0,
              layerMask: 1,
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "shadowCasterDrawList.commandEncodingDeferred",
          severity: "warning",
          shadowId: 7,
          lightId: 11,
          message:
            "Shadow caster draw lists are planned, but shadow command encoding is not implemented yet.",
        },
      ],
    });
    expect(JSON.parse(shadowCasterDrawListPlanReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPURenderPass|GPUCommandEncoder|"raw"/,
    );
  });

  it("reports missing pass plans and empty caster lists", () => {
    const missing = shadowCasterDrawListPlanReportToJsonValue(
      createShadowCasterDrawListPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        meshDraws: [meshDraw(1, 1)],
        shadowPassPlan: createShadowPassPlanReport({
          shadowRequests: [shadowRequest(7, 11)],
          textures: createShadowTextureResourceReport({
            descriptors: createShadowMapDescriptorReport({
              shadowRequests: [shadowRequest(7, 11)],
              descriptors: [],
            }),
          }),
        }),
      }),
    );
    const empty = shadowCasterDrawListPlanReportToJsonValue(
      createShadowCasterDrawListPlanReport({
        shadowRequests: [shadowRequest(7, 11)],
        meshDraws: [meshDraw(2, 4)],
        shadowPassPlan: shadowPassPlan(),
      }),
    );

    expect(missing.status).toBe("missing");
    expect(missing.listCount).toBe(0);
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterDrawList.missingPassPlan",
    ]);
    expect(empty.status).toBe("deferred");
    expect(empty.includedDrawCount).toBe(0);
    expect(empty.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterDrawList.noCasters",
    ]);
  });

  it("skips mesh draws whose ECS shadow caster flag is disabled", () => {
    const report = createShadowCasterDrawListPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      meshDraws: [
        meshDraw(1, 1, { castsShadow: false }),
        meshDraw(2, 1, { castsShadow: true }),
      ],
      shadowPassPlan: shadowPassPlan(),
    });

    expect(report.includedDrawCount).toBe(1);
    expect(report.skippedDrawCount).toBe(1);
    expect(report.lists[0]?.draws.map((draw) => draw.renderId)).toEqual([2]);
  });
});

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

function meshDraw(
  renderId: number,
  layerMask: number,
  options: Pick<MeshDrawPacket, "castsShadow" | "receivesShadow"> = {},
): MeshDrawPacket {
  return {
    renderId,
    entity: { index: renderId, generation: 0 },
    mesh: createMeshHandle(`mesh-${renderId}`),
    material: createMaterialHandle(`material-${renderId}`),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask,
    ...options,
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "standard",
      materialKey: `material-${renderId}`,
      meshKey: `mesh-${renderId}`,
      depth: 0,
      stableId: renderId,
    },
    batchKey: {
      pipelineKey: "standard",
      materialKey: `material-${renderId}`,
      meshLayoutKey: `mesh-${renderId}`,
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}
