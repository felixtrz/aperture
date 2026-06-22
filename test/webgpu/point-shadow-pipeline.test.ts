import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createPointShadowMatrixComputationReport,
  createPointShadowViewProjectionPlanReport,
  createShadowCasterCommandPlanReadinessReport,
  createShadowCasterDrawListPlanReport,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassCommandEncodingReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  pointShadowMatrixComputationReportToJsonValue,
  pointShadowViewProjectionPlanReportToJsonValue,
  shadowPassCommandEncodingReportToJsonValue,
  type LightPacket,
  type MeshDrawPacket,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("point shadow cube-map pipeline planning", () => {
  it("expands one point shadow request into six face passes and matrices", () => {
    const input = pointShadowInput();
    const pointViewProjection = pointShadowViewProjectionPlanReportToJsonValue(
      input.viewProjection,
    );
    const pointMatrices = pointShadowMatrixComputationReportToJsonValue(
      input.matrices,
    );
    const commandEncoding = shadowPassCommandEncodingReportToJsonValue(
      input.commandEncoding,
    );

    expect(input.descriptors.descriptors[0]).toMatchObject({
      shadowId: 7,
      lightId: 11,
      lightKind: "point",
      faceCount: 6,
      viewDimension: "cube",
      mapSize: 512,
    });
    expect(input.textures.textures[0]).toMatchObject({
      resourceKey: "shadow-map:7:light:11",
      viewDimension: "cube",
      faceCount: 6,
      attachmentViewKeys: [
        "shadow-map:7:light:11:face-0:view",
        "shadow-map:7:light:11:face-1:view",
        "shadow-map:7:light:11:face-2:view",
        "shadow-map:7:light:11:face-3:view",
        "shadow-map:7:light:11:face-4:view",
        "shadow-map:7:light:11:face-5:view",
      ],
    });
    expect(input.shadowPassPlan.passCount).toBe(6);
    expect(input.shadowPassPlan.passes.map((pass) => pass.passKey)).toEqual([
      "shadow-pass:7:light:11:face:0",
      "shadow-pass:7:light:11:face:1",
      "shadow-pass:7:light:11:face:2",
      "shadow-pass:7:light:11:face:3",
      "shadow-pass:7:light:11:face:4",
      "shadow-pass:7:light:11:face:5",
    ]);
    expect(input.shadowPassPlan.passes.map((pass) => pass.viewKey)).toEqual(
      input.textures.textures[0]?.attachmentViewKeys,
    );
    expect(pointViewProjection).toMatchObject({
      ready: true,
      status: "ready",
      requestCount: 1,
      passCount: 6,
      planCount: 6,
    });
    expect(pointViewProjection.plans.map((plan) => plan.faceLabel)).toEqual([
      "+x",
      "-x",
      "+y",
      "-y",
      "+z",
      "-z",
    ]);
    expect(pointMatrices).toMatchObject({
      ready: true,
      status: "ready",
      planCount: 6,
      matrixCount: 6,
    });
    expect(pointMatrices.matrices.every((matrix) => matrix.near > 0)).toBe(
      true,
    );
    expect(pointMatrices.matrices.every((matrix) => matrix.far === 8)).toBe(
      true,
    );
    expect(input.matrixDescriptor).toMatchObject({
      ready: true,
      status: "ready",
      matrixCount: 6,
    });
    expect(commandEncoding).toMatchObject({
      ready: true,
      status: "ready",
      counts: {
        passes: 6,
        depthViews: 1,
        matrixBuffers: 1,
        casterLists: 6,
        commandPlans: 6,
        commandRecords: 6,
        drawCommands: 6,
      },
      diagnostics: [],
    });
    expect(
      commandEncoding.records.map((record) => record.depthViewKey),
    ).toEqual(input.textures.textures[0]?.attachmentViewKeys);
    expect(JSON.stringify(commandEncoding)).not.toMatch(
      /GPUTexture|GPUTextureView|GPUBuffer|"raw"/,
    );
  });
});

function pointShadowInput() {
  const request = shadowRequest();
  const descriptors = createShadowMapDescriptorReport({
    shadowRequests: [request],
    descriptors: [
      {
        shadowId: 7,
        lightId: 11,
        mapSize: 512,
        depthBias: 0.004,
      },
    ],
  });
  const textures = createShadowTextureResourceReport({ descriptors });
  const shadowPassPlan = createShadowPassPlanReport({
    shadowRequests: [request],
    textures,
    submission: "ready",
  });
  const viewProjection = createPointShadowViewProjectionPlanReport({
    shadowRequests: [request],
    lights: [light()],
    shadowPassPlan,
    computation: "ready",
  });
  const matrices = createPointShadowMatrixComputationReport({
    viewProjection,
    transforms: identityTransform(),
  });
  const matrixDescriptor = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: "ready",
    resourceKey: "shadow-matrix-buffer:point",
  });
  const matrixResource = createShadowMatrixBufferResourceReport({
    device: bufferDevice(),
    descriptor: matrixDescriptor,
    matrices,
  });
  const casterDrawList = createShadowCasterDrawListPlanReport({
    shadowRequests: [request],
    meshDraws: [meshDraw()],
    shadowPassPlan,
    commandEncoding: "ready",
  });
  const commandPlan = createShadowCasterCommandPlanReadinessReport({
    shadowPassPlan,
    viewProjection,
    matrixBuffer: matrixDescriptor,
    casterDrawList,
    commandEncoding: "ready",
  });
  const depthTextureResources = createShadowDepthTextureResourceReport({
    device: textureDevice(),
    textures,
  });
  const commandEncoding = createShadowPassCommandEncodingReport({
    shadowPassPlan,
    depthTextureResources,
    matrixBufferResource: matrixResource,
    casterDrawList,
    commandPlan,
    commandEncoding: "ready",
  });

  return {
    descriptors,
    textures,
    shadowPassPlan,
    viewProjection,
    matrices,
    matrixDescriptor,
    commandEncoding,
  };
}

function shadowRequest(): ShadowRequestPacket {
  return {
    shadowId: 7,
    lightId: 11,
    lightKind: "point",
    casterLayerMask: 1,
    receiverLayerMask: 1,
  };
}

function light(): LightPacket {
  return {
    lightId: 11,
    entity: { index: 11, generation: 0 },
    kind: "point",
    color: [1, 1, 1, 1],
    intensity: 12,
    range: 8,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function meshDraw(): MeshDrawPacket {
  return {
    renderId: 101,
    entity: { index: 101, generation: 0 },
    mesh: createMeshHandle("mesh:caster"),
    material: createMaterialHandle("material:caster"),
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
      materialKey: "material:caster",
      meshKey: "mesh:caster",
      depth: 0,
      stableId: 101,
    },
    batchKey: {
      pipelineKey: "standard",
      materialKey: "material:caster",
      meshLayoutKey: "mesh:caster",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function textureDevice(): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => ({
      descriptor,
      createView: (viewDescriptor?: unknown) => ({ viewDescriptor }),
    }),
  };
}

function bufferDevice(): WebGpuBufferDeviceLike {
  return {
    createBuffer: (descriptor) => ({ descriptor }),
    queue: {
      writeBuffer: () => {},
    },
  };
}
