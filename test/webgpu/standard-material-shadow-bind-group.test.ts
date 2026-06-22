import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassPlanReport,
  createShadowSamplerResourceReport,
  createShadowTextureResourceReport,
  createStandardMaterialShadowBindGroupDescriptorReadinessReport,
  createStandardMaterialShadowBindGroupResourceReport,
  shadowSamplerResourceReportToJsonValue,
  standardMaterialShadowBindGroupDescriptorReadinessReportToJson,
  standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue,
  standardMaterialShadowBindGroupResourceReportToJsonValue,
  type LightPacket,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("StandardMaterial shadow bind group descriptor planning", () => {
  it("plans group 5 matrix and depth resource keys while sampler creation is deferred", () => {
    const resources = shadowResources();
    const report =
      createStandardMaterialShadowBindGroupDescriptorReadinessReport({
        standardMaterialCount: 2,
        matrixBufferResource: resources.matrixBufferResource,
        depthTextureResources: resources.depthTextureResources,
      });
    const json =
      standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(
        report,
      );

    expect(json).toMatchObject({
      ready: false,
      status: "deferred",
      standardMaterialCount: 2,
      group: 5,
      entryCount: 2,
      sections: {
        layoutMetadata: true,
        descriptorPlan: true,
        matrixBufferResource: true,
        depthTextureResource: true,
        samplerResource: false,
        bindGroupResource: false,
        shaderSampling: false,
      },
      plan: {
        valid: false,
        group: 5,
        resourceKey: null,
        entries: [
          {
            group: 5,
            binding: 0,
            resourceKey: "shadow-matrix-buffer:directional",
            resourceKind: "buffer",
          },
          {
            group: 5,
            binding: 1,
            resourceKey: "shadow-map:7:light:11:texture",
            resourceKind: "texture-view",
          },
        ],
        diagnostics: [
          {
            code: "standardMaterialShadowBindGroup.samplerResourceDeferred",
            severity: "warning",
            binding: 2,
            resourceKey: "shadow-sampler:directional",
          },
        ],
      },
      diagnostics: [
        {
          code: "standardMaterialShadowBindGroup.samplerResourceDeferred",
          severity: "warning",
          binding: 2,
        },
        {
          code: "standardMaterialShadowBindGroup.bindGroupCreationDeferred",
          severity: "warning",
        },
        {
          code: "standardMaterialShadowBindGroup.shaderSamplingDeferred",
          severity: "warning",
        },
      ],
    });
    expect(
      JSON.parse(
        standardMaterialShadowBindGroupDescriptorReadinessReportToJson(report),
      ),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUBuffer|GPUTexture|"raw"/);
  });

  it("creates and reuses live group 5 bind group resources when sampler exists", () => {
    const createdBindGroupLayouts: unknown[] = [];
    const createdBindGroups: unknown[] = [];
    const device = deviceWithResources({
      createdBindGroupLayouts,
      createdBindGroups,
    });
    const resources = shadowResources(device);
    const sampler = createShadowSamplerResourceReport({ device });
    const descriptor =
      createStandardMaterialShadowBindGroupDescriptorReadinessReport({
        standardMaterialCount: 2,
        matrixBufferResource: resources.matrixBufferResource,
        depthTextureResources: resources.depthTextureResources,
        samplerResource: sampler,
      });
    const cache = new Map();

    const first = standardMaterialShadowBindGroupResourceReportToJsonValue(
      createStandardMaterialShadowBindGroupResourceReport({
        device,
        standardMaterialCount: 2,
        descriptor,
        matrixBufferResource: resources.matrixBufferResource,
        depthTextureResources: resources.depthTextureResources,
        samplerResource: sampler,
        cache,
      }),
    );
    const second = standardMaterialShadowBindGroupResourceReportToJsonValue(
      createStandardMaterialShadowBindGroupResourceReport({
        device,
        standardMaterialCount: 2,
        descriptor,
        matrixBufferResource: resources.matrixBufferResource,
        depthTextureResources: resources.depthTextureResources,
        samplerResource: sampler,
        cache,
      }),
    );

    expect(
      standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(
        descriptor,
      ),
    ).toMatchObject({
      ready: false,
      status: "deferred",
      entryCount: 3,
      sections: {
        samplerResource: true,
        bindGroupResource: false,
      },
      plan: {
        valid: true,
        resourceKey: expect.stringMatching(
          /^bind-group:standard\/shadow\/group-5\//,
        ),
        entries: [
          { binding: 0, resourceKind: "buffer" },
          { binding: 1, resourceKind: "texture-view" },
          {
            binding: 2,
            resourceKey: "shadow-sampler:directional",
            resourceKind: "sampler",
          },
        ],
        diagnostics: [],
      },
    });
    expect(first).toMatchObject({
      ready: true,
      status: "available",
      standardMaterialCount: 2,
      group: 5,
      createdBindGroupCount: 1,
      reusedBindGroupCount: 0,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        matrixBufferResource: true,
        depthTextureResource: true,
        samplerResource: true,
        bindGroupResource: true,
        passSubmission: false,
        shaderSampling: false,
      },
      resource: {
        group: 5,
        resourceKey: expect.stringMatching(
          /^bind-group:standard\/shadow\/group-5\//,
        ),
        layoutKey: "standard/shadow/group-5",
        entryResourceKeys: [
          "shadow-matrix-buffer:directional",
          "shadow-map:7:light:11:texture",
          "shadow-sampler:directional",
        ],
      },
      diagnostics: [
        {
          code: "standardMaterialShadowBindGroupResource.passSubmissionDeferred",
          severity: "warning",
        },
        {
          code: "standardMaterialShadowBindGroupResource.shaderSamplingDeferred",
          severity: "warning",
        },
      ],
    });
    expect(second.createdBindGroupCount).toBe(0);
    expect(second.reusedBindGroupCount).toBe(1);
    expect(createdBindGroupLayouts).toHaveLength(1);
    expect(createdBindGroups).toHaveLength(1);
    expect(createdBindGroupLayouts[0]).toMatchObject({
      label: "standard/shadow/group-5",
      entries: [
        { binding: 0, buffer: { type: "read-only-storage" } },
        { binding: 1, texture: { sampleType: "depth" } },
        { binding: 2, sampler: { type: "comparison" } },
      ],
    });
    expect(JSON.stringify(first)).not.toMatch(
      /GPUBuffer|GPUTexture|GPUSampler|"raw"/,
    );
  });

  it("accepts cascaded 2D-array depth textures after receiver sampling support", () => {
    const device = deviceWithResources();
    const resources = shadowResources(device);
    const request = { ...shadowRequest(), cascadeCount: 3 };
    const depthTextureResources = createShadowDepthTextureResourceReport({
      device,
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [request],
          descriptors: [
            { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
          ],
        }),
      }),
    });

    const report =
      createStandardMaterialShadowBindGroupDescriptorReadinessReport({
        standardMaterialCount: 1,
        matrixBufferResource: resources.matrixBufferResource,
        depthTextureResources,
      });

    expect(report.status).toBe("deferred");
    expect(report.sections.depthTextureResource).toBe(true);
    expect(report.plan?.entries).toContainEqual({
      group: 5,
      binding: 1,
      resourceKey: "shadow-map:7:light:11:texture",
      resourceKind: "texture-view",
    });
    expect(
      report.diagnostics.map((diagnostic) => diagnostic.code),
    ).not.toContain(
      "standardMaterialShadowBindGroup.unsupportedDepthTextureView",
    );
  });

  it("creates and reuses a JSON-safe shadow sampler resource", () => {
    const createdSamplers: unknown[] = [];
    const cache = new Map();
    const device = deviceWithResources({ createdSamplers });

    const first = shadowSamplerResourceReportToJsonValue(
      createShadowSamplerResourceReport({ device, cache }),
    );
    const second = shadowSamplerResourceReportToJsonValue(
      createShadowSamplerResourceReport({ device, cache }),
    );

    expect(first).toMatchObject({
      ready: true,
      status: "available",
      createdSamplerCount: 1,
      reusedSamplerCount: 0,
      resource: {
        resourceKey: "shadow-sampler:directional",
        descriptor: {
          compare: "less-equal",
          magFilter: "nearest",
          minFilter: "nearest",
        },
      },
    });
    expect(second.createdSamplerCount).toBe(0);
    expect(second.reusedSamplerCount).toBe(1);
    expect(createdSamplers).toHaveLength(1);
    expect(JSON.stringify(second)).not.toMatch(/GPUSampler|"raw"/);
  });

  it("reports missing matrix and depth resources", () => {
    const resources = shadowResources();
    const missing =
      standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(
        createStandardMaterialShadowBindGroupDescriptorReadinessReport({
          standardMaterialCount: 1,
          matrixBufferResource: {
            ...resources.matrixBufferResource,
            status: "missing",
            ready: false,
            resource: null,
          },
          depthTextureResources: {
            ...resources.depthTextureResources,
            status: "missing",
            ready: false,
            resources: [],
          },
        }),
      );

    expect(missing.status).toBe("missing");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialShadowBindGroup.missingMatrixBufferResource",
      "standardMaterialShadowBindGroup.missingDepthTextureResource",
      "standardMaterialShadowBindGroup.samplerResourceDeferred",
    ]);
  });
});

function shadowResources(device = deviceWithResources()) {
  const viewProjection = createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest()],
    lights: [light()],
    shadowPassPlan: shadowPassPlan(),
  });
  const matrixBuffer = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: "ready",
  });
  const matrices = createDirectionalShadowMatrixComputationReport({
    viewProjection,
    transforms: identityTransform(),
  });
  const matrixBufferResource = createShadowMatrixBufferResourceReport({
    device,
    descriptor: matrixBuffer,
    matrices,
  });
  const depthTextureResources = createShadowDepthTextureResourceReport({
    device,
    textures: createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest()],
        descriptors: [
          { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
        ],
      }),
    }),
  });

  return { matrixBufferResource, depthTextureResources };
}

function shadowPassPlan() {
  return createShadowPassPlanReport({
    shadowRequests: [shadowRequest()],
    textures: createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest()],
        descriptors: [
          { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
        ],
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

function deviceWithResources(
  captures: {
    readonly createdSamplers?: unknown[];
    readonly createdBindGroupLayouts?: unknown[];
    readonly createdBindGroups?: unknown[];
  } = {},
): TextureGpuDeviceLike &
  WebGpuBufferDeviceLike & {
    createBindGroupLayout: (descriptor: unknown) => unknown;
    createBindGroup: (descriptor: unknown) => unknown;
  } {
  return {
    createTexture: (descriptor) => ({
      createView: () => ({ descriptor }),
    }),
    createSampler: (descriptor) => {
      captures.createdSamplers?.push(descriptor);

      return { descriptor };
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroupLayout: (descriptor) => {
      captures.createdBindGroupLayouts?.push(descriptor);

      return { descriptor };
    },
    createBindGroup: (descriptor) => {
      captures.createdBindGroups?.push(descriptor);

      return { descriptor };
    },
    queue: {
      writeBuffer: () => {},
    },
  };
}
