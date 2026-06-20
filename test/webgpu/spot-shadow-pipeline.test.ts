import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createShadowCasterCommandPlanReadinessReport,
  createShadowCasterDrawListPlanReport,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassCommandEncodingReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  createSpotShadowMatrixComputationReport,
  createSpotShadowViewProjectionPlanReport,
  shadowPassCommandEncodingReportToJsonValue,
  spotShadowMatrixComputationReportToJsonValue,
  spotShadowViewProjectionPlanReportToJsonValue,
  type LightPacket,
  type MeshDrawPacket,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("spot shadow 2D pipeline planning", () => {
  it("keeps one spot shadow request as one 2D pass and matrix", () => {
    const input = spotShadowInput();
    const spotViewProjection = spotShadowViewProjectionPlanReportToJsonValue(
      input.viewProjection,
    );
    const spotMatrices = spotShadowMatrixComputationReportToJsonValue(
      input.matrices,
    );
    const commandEncoding = shadowPassCommandEncodingReportToJsonValue(
      input.commandEncoding,
    );

    expect(input.descriptors.descriptors[0]).toMatchObject({
      shadowId: 13,
      lightId: 17,
      lightKind: "spot",
      faceCount: 1,
      viewDimension: "2d",
      mapSize: 512,
    });
    expect(input.textures.textures[0]).toMatchObject({
      resourceKey: "shadow-map:13:light:17",
      viewDimension: "2d",
      faceCount: 1,
      attachmentViewKeys: ["shadow-map:13:light:17:view"],
    });
    expect(input.shadowPassPlan.passCount).toBe(1);
    expect(input.shadowPassPlan.passes.map((pass) => pass.passKey)).toEqual([
      "shadow-pass:13:light:17",
    ]);
    expect(input.shadowPassPlan.passes.map((pass) => pass.viewKey)).toEqual(
      input.textures.textures[0]?.attachmentViewKeys,
    );
    expect(spotViewProjection).toMatchObject({
      ready: true,
      status: "ready",
      requestCount: 1,
      passCount: 1,
      planCount: 1,
    });
    expect(spotViewProjection.plans[0]).toMatchObject({
      lightKind: "spot",
      projection: "perspective-spot",
      fovYRadians: 1,
      // near scales with the light range for perspective depth precision
      // (max(range * 0.02, 0.05)); range 12 -> 0.24. Mirrors the point fix.
      near: 0.24,
      far: 12,
      passKey: "shadow-pass:13:light:17",
    });
    expect(spotMatrices).toMatchObject({
      ready: true,
      status: "ready",
      planCount: 1,
      matrixCount: 1,
      matrices: [
        {
          passKey: "shadow-pass:13:light:17",
          lightDirection: [0, 0, -1],
          near: 0.24,
          far: 12,
        },
      ],
    });
    expect(input.matrixDescriptor).toMatchObject({
      ready: true,
      status: "ready",
      matrixCount: 1,
    });
    expect(commandEncoding).toMatchObject({
      ready: true,
      status: "ready",
      counts: {
        passes: 1,
        depthViews: 1,
        matrixBuffers: 1,
        casterLists: 1,
        commandPlans: 1,
        commandRecords: 1,
        drawCommands: 1,
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

  it("keeps near strictly below far for a tiny-range spot (no makePerspective throw)", () => {
    // range <= 0.05 would make the 0.05 near floor >= far (= range); the near
    // formula caps near at range * 0.5 so makePerspective never throws.
    const request = shadowRequest();
    const shadowPassPlan = createShadowPassPlanReport({
      shadowRequests: [request],
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [request],
          descriptors: [{ shadowId: 13, lightId: 17, mapSize: 512 }],
        }),
      }),
      submission: "ready",
    });
    const viewProjection = createSpotShadowViewProjectionPlanReport({
      shadowRequests: [request],
      lights: [{ ...light(), range: 0.04 }],
      shadowPassPlan,
      computation: "ready",
    });

    const plan = viewProjection.plans[0];
    expect(plan?.far).toBe(0.04);
    expect(plan?.near).toBeLessThan(0.04);
    expect(plan?.near).toBeGreaterThan(0);

    // The matrix computation calls makePerspective; it must not throw and must
    // produce a finite, ready matrix.
    const matrices = createSpotShadowMatrixComputationReport({
      viewProjection,
      transforms: identityTransform(),
    });
    expect(matrices.status).toBe("ready");
    expect(
      matrices.matrices[0]?.viewProjectionMatrix.every(Number.isFinite),
    ).toBe(true);
  });
});

function spotShadowInput() {
  const request = shadowRequest();
  const descriptors = createShadowMapDescriptorReport({
    shadowRequests: [request],
    descriptors: [
      {
        shadowId: 13,
        lightId: 17,
        mapSize: 512,
        depthBias: 0.002,
        normalBias: 0.01,
      },
    ],
  });
  const textures = createShadowTextureResourceReport({ descriptors });
  const shadowPassPlan = createShadowPassPlanReport({
    shadowRequests: [request],
    textures,
    submission: "ready",
  });
  const viewProjection = createSpotShadowViewProjectionPlanReport({
    shadowRequests: [request],
    lights: [light()],
    shadowPassPlan,
    computation: "ready",
  });
  const matrices = createSpotShadowMatrixComputationReport({
    viewProjection,
    transforms: identityTransform(),
  });
  const matrixDescriptor = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: "ready",
    resourceKey: "shadow-matrix-buffer:spot",
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
    shadowId: 13,
    lightId: 17,
    lightKind: "spot",
    casterLayerMask: 1,
    receiverLayerMask: 1,
  };
}

function light(): LightPacket {
  return {
    lightId: 17,
    entity: { index: 17, generation: 0 },
    kind: "spot",
    color: [1, 1, 1, 1],
    intensity: 24,
    range: 12,
    innerConeAngle: 0.2,
    outerConeAngle: 0.5,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function meshDraw(): MeshDrawPacket {
  return {
    renderId: 103,
    entity: { index: 103, generation: 0 },
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
      stableId: 103,
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
