import { describe, expect, it } from "vitest";

import {
  createDiffuseIblTextureResourceReport,
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblSamplerDescriptorReadinessReport,
  createIblSamplerResourceReport,
  createIblTexturePreparationReport,
  createSpecularIblTextureResourceReport,
  createStandardMaterialIblBindGroupDescriptorReadinessReport,
  createStandardMaterialIblBindGroupResourceReport,
  standardMaterialIblBindGroupDescriptorReadinessReportToJson,
  standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue,
  standardMaterialIblBindGroupResourceReportToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("StandardMaterial IBL bind group descriptor planning", () => {
  it("plans group 4 resource keys while specular prefiltering is deferred", () => {
    const texturesReport = textures();
    const report = createStandardMaterialIblBindGroupDescriptorReadinessReport({
      standardMaterialCount: 2,
      textures: texturesReport,
      diffuseTextureResource: createDiffuseIblTextureResourceReport({
        device: deviceWithResources(),
        textures: texturesReport,
      }),
      samplers: createIblSamplerResourceReport({
        device: deviceWithResources(),
        samplers: createIblSamplerDescriptorReadinessReport({
          textures: texturesReport,
          allocation: "ready",
        }),
      }),
    });
    const json =
      standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: false,
      status: "deferred",
      standardMaterialCount: 2,
      group: 4,
      entryCount: 2,
      sections: {
        layoutMetadata: true,
        descriptorPlan: true,
        diffuseTextureResource: true,
        specularTextureResource: false,
        samplerResource: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      plan: {
        valid: false,
        group: 4,
        resourceKey: null,
        entries: [
          {
            group: 4,
            binding: 0,
            resourceKey: "texture:studio:diffuse-irradiance:texture",
            resourceKind: "texture-view",
          },
          {
            group: 4,
            binding: 2,
            resourceKey: "texture:studio:diffuse-irradiance:sampler",
            resourceKind: "sampler",
          },
        ],
        diagnostics: [
          {
            code: "standardMaterialIblBindGroup.specularTextureResourceDeferred",
            severity: "warning",
            binding: 1,
            resourceKey: "texture:studio:specular-prefilter:texture",
            message:
              "StandardMaterial IBL bind-group descriptor planning requires a renderer-owned specular prefilter texture resource, which is still deferred.",
          },
        ],
      },
      diagnostics: [
        {
          code: "standardMaterialIblBindGroup.specularTextureResourceDeferred",
          severity: "warning",
          binding: 1,
          resourceKey: "texture:studio:specular-prefilter:texture",
          message:
            "StandardMaterial IBL bind-group descriptor planning requires a renderer-owned specular prefilter texture resource, which is still deferred.",
        },
        {
          code: "standardMaterialIblBindGroup.shaderSamplingDeferred",
          severity: "warning",
          message:
            "StandardMaterial IBL bind-group descriptor keys are planned, but WGSL shader sampling is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(
        standardMaterialIblBindGroupDescriptorReadinessReportToJson(report),
      ),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUSampler|"raw"/);
  });

  it("creates and reuses live group 4 bind group resources from IBL resources", () => {
    const createdBindGroups: unknown[] = [];
    const createdLayouts: unknown[] = [];
    const device = deviceWithBindGroups(createdLayouts, createdBindGroups);
    const texturesReport = textures();
    const diffuseTextureResource = createDiffuseIblTextureResourceReport({
      device,
      textures: texturesReport,
    });
    const specularTextureResource = createSpecularIblTextureResourceReport({
      device,
      textures: texturesReport,
    });
    const samplerResources = createIblSamplerResourceReport({
      device,
      samplers: createIblSamplerDescriptorReadinessReport({
        textures: texturesReport,
        allocation: "ready",
      }),
    });
    const descriptor =
      createStandardMaterialIblBindGroupDescriptorReadinessReport({
        standardMaterialCount: 2,
        textures: texturesReport,
        diffuseTextureResource,
        specularTextureResource,
        samplers: samplerResources,
      });
    const cache = new Map();

    const first = createStandardMaterialIblBindGroupResourceReport({
      device,
      standardMaterialCount: 2,
      descriptor,
      diffuseTextureResource,
      specularTextureResource,
      samplers: samplerResources,
      cache,
    });
    const second = createStandardMaterialIblBindGroupResourceReport({
      device,
      standardMaterialCount: 2,
      descriptor,
      diffuseTextureResource,
      specularTextureResource,
      samplers: samplerResources,
      cache,
    });
    const json = standardMaterialIblBindGroupResourceReportToJsonValue(second);

    expect(first.createdBindGroupCount).toBe(1);
    expect(first.reusedBindGroupCount).toBe(0);
    expect(second.createdBindGroupCount).toBe(0);
    expect(second.reusedBindGroupCount).toBe(1);
    expect(json).toMatchObject({
      ready: true,
      status: "available",
      standardMaterialCount: 2,
      group: 4,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        textureResources: true,
        samplerResource: true,
        bindGroupResource: true,
        shaderSampling: false,
      },
      resource: {
        group: 4,
        layoutKey: "standard/ibl/group-4",
        entryResourceKeys: [
          "texture:studio:diffuse-irradiance:texture",
          "texture:studio:specular-prefilter:texture",
          "texture:studio:diffuse-irradiance:sampler",
        ],
      },
      diagnostics: [
        {
          code: "standardMaterialIblBindGroupResource.shaderSamplingDeferred",
          severity: "warning",
        },
      ],
    });
    expect(createdLayouts).toHaveLength(1);
    expect(createdBindGroups).toHaveLength(1);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUTextureView|GPUSampler|GPUBindGroup|"raw"/,
    );
  });
});

function textures() {
  return createIblTexturePreparationReport({
    descriptors: createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          diffuseResourceKey: "texture:studio:diffuse-irradiance",
          specularResourceKey: "texture:studio:specular-prefilter",
        },
      ],
    }),
  });
}

function environment(
  environmentId: number,
  handleId: string,
): EnvironmentPacket {
  return {
    environmentId,
    handle: createEnvironmentMapHandle(handleId),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}

function deviceWithResources(): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => ({
      createView: () => ({ descriptor }),
    }),
    createSampler: (descriptor) => ({ descriptor }),
  };
}

function deviceWithBindGroups(
  createdLayouts: unknown[],
  createdBindGroups: unknown[],
): TextureGpuDeviceLike & {
  createBindGroupLayout(descriptor: unknown): unknown;
  createBindGroup(descriptor: unknown): unknown;
} {
  return {
    createTexture: (descriptor) => ({
      createView: () => ({ descriptor }),
    }),
    createSampler: (descriptor) => ({ descriptor }),
    createBindGroupLayout: (descriptor) => {
      createdLayouts.push(descriptor);
      return { layoutDescriptor: descriptor };
    },
    createBindGroup: (descriptor) => {
      createdBindGroups.push(descriptor);
      return { bindGroupDescriptor: descriptor };
    },
  };
}
